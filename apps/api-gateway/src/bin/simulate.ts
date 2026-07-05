import http from "node:http";
import type { AddressInfo } from "node:net";

const PROXY = process.env.PROXY_URL ?? "http://127.0.0.1:4700";
const CONTROL = process.env.CONTROL_URL ?? "http://127.0.0.1:4701";

interface UpstreamHandle {
  port: number;
  close: () => void;
  setMode: (m: "ok" | "fail") => void;
}

function spawnUpstream(label: string, mode: "ok" | "fail" = "ok"): Promise<UpstreamHandle> {
  let current = mode;
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200).end("ok");
        return;
      }
      if (current === "fail") {
        res.writeHead(500, { "content-type": "application/json" }).end(
          JSON.stringify({ error: "synthetic_failure", upstream: label }),
        );
        return;
      }
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            ok: true,
            from: label,
            method: req.method,
            path: req.url,
            xRequestId: req.headers["x-request-id"] ?? null,
            xForwardedBy: req.headers["x-forwarded-by"] ?? null,
            xConsumerId: req.headers["x-consumer-id"] ?? null,
            body: body || null,
          }),
        );
      });
    });
    server.listen(0, () => {
      resolve({
        port: (server.address() as AddressInfo).port,
        close: () => server.close(),
        setMode: (m) => { current = m; },
      });
    });
  });
}

async function api(url: string, init: RequestInit = {}): Promise<{ status: number; body: unknown; headers: Record<string,string> }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch {}
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  return { status: res.status, body, headers };
}

function log(label: string, data: unknown): void {
  console.log(`\n=== ${label} ===\n${JSON.stringify(data, null, 2)}`);
}

function counts<T extends string>(items: T[]): Record<T, number> {
  return items.reduce<Record<string, number>>((acc, k) => {
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {}) as Record<T, number>;
}

async function main(): Promise<void> {
  const up = await spawnUpstream("svc-a");
  const baseUrl = `http://127.0.0.1:${up.port}`;
  log("upstream up", { baseUrl });

  await api(`${CONTROL}/routes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      id: "echo-route",
      pathPrefix: "/api",
      methods: ["GET", "POST"],
      backends: [{ url: baseUrl }],
      stripPrefix: true,
      auth: "none",
      rateLimit: { windowMs: 1000, max: 5 },
      maxRetries: 1,
      timeoutMs: 2000,
    }),
  });
  log("route registered", { id: "echo-route", limit: "5/1s" });

  const ok = await api(`${PROXY}/api/echo`, { method: "GET" });
  log("simple GET via gateway", {
    status: ok.status,
    body: ok.body,
    rateLimitLimit: ok.headers["x-ratelimit-limit"],
    rateLimitRemaining: ok.headers["x-ratelimit-remaining"],
    xRequestId: ok.headers["x-request-id"],
  });

  const burst = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      api(`${PROXY}/api/echo?i=${i}`, { method: "GET" }).then((r) => r.status),
    ),
  );
  log("burst of 12 in <1s (limit 5/1s)", {
    statuses: burst,
    distribution: counts(burst.map(String)),
  });

  await new Promise((r) => setTimeout(r, 1100));
  up.setMode("fail");

  const failBurst = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      api(`${PROXY}/api/echo?i=${i}`, { method: "GET" }).then((r) => r.status),
    ),
  );
  log("6 requests with upstream failing (circuit threshold)", {
    statuses: failBurst,
  });

  await new Promise((r) => setTimeout(r, 50));
  const circuit1 = await api(`${PROXY}/api/echo?probe=1`, { method: "GET" });
  log("after-circuit-open request", {
    status: circuit1.status,
    body: circuit1.body,
  });

  const cstats1 = await api(`${CONTROL}/circuit`);
  log("circuit stats (should show open)", cstats1.body);

  log("sleeping past circuit openMs (5s)...", { wait: 5500 });
  await new Promise((r) => setTimeout(r, 5500));

  up.setMode("ok");
  const probe = await api(`${PROXY}/api/echo?probe=2`, { method: "GET" });
  log("half-open probe (upstream healthy again)", {
    status: probe.status,
    body: probe.body,
  });
  const cstats2 = await api(`${CONTROL}/circuit`);
  log("circuit stats (should show closed)", cstats2.body);

  const metrics = await fetch(`${CONTROL}/metrics`);
  const metricsText = await metrics.text();
  const interesting = metricsText.split("\n").filter((l) =>
    /^gw_requests_total|^gw_rate_limited_total|^gw_circuit_short_total|gw_request_duration_ms_count/.test(l),
  );
  log("metrics snapshot", { lines: interesting });

  up.close();
  log("done", { ok: true });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
