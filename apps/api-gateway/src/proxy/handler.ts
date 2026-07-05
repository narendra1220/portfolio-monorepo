import type { IncomingMessage, ServerResponse } from "node:http";
import { ulid } from "ulid";
import type { Config } from "../config.js";
import type { CircuitBreaker } from "../middleware/circuit.js";
import type { RateLimiter } from "../middleware/rateLimit.js";
import type { Counters } from "../metrics/counters.js";
import type { Router } from "../routes/router.js";
import type { AccessLog, RouteCfg } from "../types.js";
import { forwardAndStream, readBody } from "./forwarder.js";
import { verifyConsumer } from "../auth.js";

const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

export interface HandlerDeps {
  router: Router;
  rateLimiter: RateLimiter;
  circuit: CircuitBreaker;
  counters: Counters;
  cfg: Config;
  onAccessLog?: (log: AccessLog) => void;
}

export function makeProxyHandler(deps: HandlerDeps) {
  return async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const id = ulid();
    const start = performance.now();
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0] ?? "/";
    let consumer = "anonymous";
    let routeId = "unmatched";
    let upstream = "";
    let retries = 0;
    let status = 0;
    let rateLimited = false;
    let circuitOpen = false;
    let error: string | undefined;

    const finalize = (): void => {
      const log: AccessLog = {
        id,
        ts: Date.now(),
        durationMs: performance.now() - start,
        consumer,
        routeId,
        upstream,
        method,
        path,
        status,
        retries,
      };
      if (rateLimited) log.rateLimited = true;
      if (circuitOpen) log.circuitOpen = true;
      if (error) log.error = error;
      deps.counters.inc("gw_requests_total", {
        route: routeId,
        method,
        status: String(status),
      });
      deps.counters.observe(
        "gw_request_duration_ms",
        { route: routeId, method },
        log.durationMs,
      );
      if (rateLimited) {
        deps.counters.inc("gw_rate_limited_total", { route: routeId });
      }
      if (circuitOpen) {
        deps.counters.inc("gw_circuit_short_total", { route: routeId });
      }
      deps.onAccessLog?.(log);
    };

    try {
      const match = deps.router.match(method, path);
      if (!match) {
        status = 404;
        res.writeHead(404, { "content-type": "application/json" }).end(
          JSON.stringify({ error: "route_not_found", path }),
        );
        return;
      }
      const route = match.route;
      routeId = route.id;

      if (route.auth === "jwt") {
        const auth = req.headers.authorization;
        if (!auth?.startsWith("Bearer ")) {
          status = 401;
          res.writeHead(401, { "content-type": "application/json" }).end(
            JSON.stringify({ error: "missing_token" }),
          );
          return;
        }
        try {
          const claims = verifyConsumer(auth.slice(7), deps.cfg.jwtSecret);
          consumer = claims.sub;
        } catch {
          status = 401;
          res.writeHead(401, { "content-type": "application/json" }).end(
            JSON.stringify({ error: "invalid_token" }),
          );
          return;
        }
      } else {
        consumer = String(req.headers["x-consumer-id"] ?? "anonymous");
      }

      if (route.rateLimit) {
        const rl = await deps.rateLimiter.check(consumer, route.id, route.rateLimit);
        res.setHeader("x-ratelimit-limit", String(rl.limit));
        res.setHeader("x-ratelimit-remaining", String(rl.remaining));
        if (rl.limited) {
          rateLimited = true;
          status = 429;
          res
            .writeHead(429, {
              "content-type": "application/json",
              "retry-after": String(Math.ceil(rl.retryAfterMs / 1000)),
            })
            .end(JSON.stringify({ error: "rate_limited", retryAfterMs: rl.retryAfterMs }));
          return;
        }
      }

      const body = await readBody(req);
      const upstreamUrl = pickBackend(route);
      upstream = upstreamUrl;

      const maxRetries =
        route.maxRetries ??
        (IDEMPOTENT.has(method.toUpperCase())
          ? deps.cfg.upstreamMaxRetries
          : 0);
      const timeoutMs = route.timeoutMs ?? deps.cfg.upstreamTimeoutMs;
      const retryOnStatus = route.retryOnStatus ?? [502, 503, 504];

      while (true) {
        const circ = deps.circuit.shouldAllow(upstream);
        if (!circ.allow) {
          circuitOpen = true;
          status = 503;
          res.writeHead(503, { "content-type": "application/json" }).end(
            JSON.stringify({ error: "circuit_open", upstream, reason: circ.reason }),
          );
          return;
        }
        try {
          const result = await forwardAndStream(
            {
              upstreamUrl: upstream,
              upstreamPath: match.upstreamPath,
              method,
              reqHeaders: req.headers as Record<string, string | string[] | undefined>,
              body,
              timeoutMs,
              consumerId: consumer,
              requestId: id,
            },
            res,
          );
          status = result.status;
          if (status >= 500) {
            deps.circuit.recordFailure(upstream, `status_${status}`);
          } else {
            deps.circuit.recordSuccess(upstream);
          }
          if (retryOnStatus.includes(status) && retries < maxRetries) {
            retries++;
            continue;
          }
          break;
        } catch (e) {
          const errMsg = (e as Error).message;
          deps.circuit.recordFailure(upstream, errMsg);
          if (!res.headersSent && retries < maxRetries) {
            retries++;
            continue;
          }
          if (!res.headersSent) {
            status = 502;
            error = errMsg;
            res.writeHead(502, { "content-type": "application/json" }).end(
              JSON.stringify({ error: "upstream_failed", details: errMsg }),
            );
          } else {
            status = 502;
            error = errMsg;
            res.end();
          }
          break;
        }
      }
    } catch (e) {
      error = (e as Error).message;
      if (!res.headersSent) {
        status = 500;
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({ error: "internal", details: error }),
        );
      } else {
        res.end();
      }
    } finally {
      finalize();
    }
  };
}

function pickBackend(route: RouteCfg): string {
  const total = route.backends.reduce((a, b) => a + (b.weight ?? 1), 0);
  let r = Math.random() * total;
  for (const b of route.backends) {
    r -= b.weight ?? 1;
    if (r <= 0) return b.url;
  }
  return route.backends[0]?.url ?? "";
}
