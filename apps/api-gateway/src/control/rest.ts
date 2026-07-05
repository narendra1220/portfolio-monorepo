import http from "node:http";
import { z } from "zod";
import type { CircuitBreaker } from "../middleware/circuit.js";
import type { Counters } from "../metrics/counters.js";
import type { RouteRegistry } from "../routes/registry.js";
import type { RouteCfg } from "../types.js";

const routeSchema = z.object({
  id: z.string().regex(/^[a-z0-9._-]+$/i),
  pathPrefix: z.string().startsWith("/"),
  methods: z.array(z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "*"])).min(1),
  backends: z
    .array(z.object({ url: z.string().url(), weight: z.number().positive().optional() }))
    .min(1),
  stripPrefix: z.boolean().optional(),
  auth: z.enum(["none", "jwt"]).optional(),
  rateLimit: z
    .object({ windowMs: z.number().int().positive(), max: z.number().int().positive() })
    .optional(),
  retryOnStatus: z.array(z.number().int()).optional(),
  maxRetries: z.number().int().min(0).max(5).optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export interface ControlDeps {
  registry: RouteRegistry;
  circuit: CircuitBreaker;
  counters: Counters;
}

export function createControlServer(deps: ControlDeps): http.Server {
  return http.createServer(async (req, res) => {
    const url = req.url ?? "/";
    const method = req.method ?? "GET";
    res.setHeader("content-type", "application/json");

    try {
      if (method === "GET" && url === "/health") {
        return reply(res, 200, { ok: true });
      }
      if (method === "GET" && url === "/routes") {
        return reply(res, 200, { items: deps.registry.list() });
      }
      if (method === "POST" && url === "/routes") {
        const body = await readJson(req);
        const parsed = routeSchema.safeParse(body);
        if (!parsed.success) {
          return reply(res, 400, { error: "validation", details: parsed.error.flatten() });
        }
        await deps.registry.upsert(parsed.data as RouteCfg);
        return reply(res, 201, { route: parsed.data });
      }
      if (method === "DELETE" && url.startsWith("/routes/")) {
        const id = decodeURIComponent(url.slice("/routes/".length));
        const ok = await deps.registry.remove(id);
        return reply(res, ok ? 200 : 404, { ok });
      }
      if (method === "GET" && url === "/circuit") {
        return reply(res, 200, deps.circuit.stats());
      }
      if (method === "GET" && url === "/metrics") {
        res.setHeader("content-type", "text/plain; version=0.0.4");
        res.writeHead(200).end(deps.counters.renderPrometheus());
        return;
      }
      reply(res, 404, { error: "not_found" });
    } catch (e) {
      reply(res, 500, { error: "internal", details: (e as Error).message });
    }
  });
}

function reply(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status).end(JSON.stringify(body));
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const s = Buffer.concat(chunks).toString("utf8");
        resolve(s ? JSON.parse(s) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}
