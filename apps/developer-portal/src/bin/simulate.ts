import http from "node:http";
import type { AddressInfo } from "node:net";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4600";

async function api(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function log(label: string, data: unknown): void {
  console.log(`\n=== ${label} ===\n${JSON.stringify(data, null, 2)}`);
}

function spawnUpstream(label: string, openapi: object): Promise<{ port: number; close: () => void }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? "/";
      if (url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ ok: true, service: label }));
        return;
      }
      if (url === "/openapi.json") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(openapi));
        return;
      }
      if (url === "/echo") {
        let body = "";
        req.on("data", (c) => (body += c));
        req.on("end", () => {
          res.writeHead(200, { "content-type": "application/json" });
          res.end(
            JSON.stringify({
              hello: "from-" + label,
              method: req.method,
              receivedBody: body ? JSON.parse(body) : null,
              upstreamHeaders: {
                "x-forwarded-by": req.headers["x-forwarded-by"] ?? null,
                "x-trace-id": req.headers["x-trace-id"] ?? null,
              },
            }),
          );
        });
        return;
      }
      res.writeHead(404).end("not found");
    });
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      resolve({
        port,
        close: () => server.close(),
      });
    });
  });
}

async function main(): Promise<void> {
  const tokenRes = (await api("/auth/dev-token", {
    method: "POST",
    body: JSON.stringify({ sub: "sim", role: "admin" }),
  })) as { token: string };
  const token = tokenRes.token;
  log("got token", { token: token.slice(0, 20) + "..." });

  const upstreamA = await spawnUpstream("svc-a", {
    openapi: "3.0.0",
    info: { title: "Service A", version: "1.0.0" },
    paths: { "/echo": { post: { summary: "echo" } } },
  });
  const upstreamB = await spawnUpstream("svc-b", {
    openapi: "3.0.0",
    info: { title: "Service B", version: "2.0.0" },
    paths: { "/echo": { post: { summary: "echo b" } } },
  });

  const baseA = `http://127.0.0.1:${upstreamA.port}`;
  const baseB = `http://127.0.0.1:${upstreamB.port}`;
  log("upstream services", { baseA, baseB });

  await api(
    "/manifests",
    {
      method: "POST",
      body: JSON.stringify({
        id: "billing-service",
        name: "Billing Service",
        description: "Handles invoices and subscription state.",
        owner: { team: "growth", contact: "growth-oncall@example.com" },
        tier: "tier-1",
        lifecycle: "ga",
        baseUrl: baseA,
        healthUrl: `${baseA}/health`,
        openapiUrl: `${baseA}/openapi.json`,
        tags: ["billing", "core"],
        links: { repo: "https://github.com/example/billing" },
      }),
    },
    token,
  );

  await api(
    "/manifests",
    {
      method: "POST",
      body: JSON.stringify({
        id: "search-service",
        name: "Search Service",
        description: "Owns the search index and query API.",
        owner: { team: "platform", contact: "platform@example.com" },
        tier: "tier-2",
        lifecycle: "beta",
        baseUrl: baseB,
        healthUrl: `${baseB}/health`,
        openapiUrl: `${baseB}/openapi.json`,
        tags: ["search"],
      }),
    },
    token,
  );
  log("registered two services", { ok: true });

  await api(
    "/manifests",
    {
      method: "POST",
      body: JSON.stringify({
        id: "billing-service",
        name: "Billing Service",
        description: "Handles invoices, subscriptions, and refunds.",
        owner: { team: "growth", contact: "growth-oncall@example.com" },
        tier: "tier-1",
        lifecycle: "ga",
        baseUrl: baseA,
        healthUrl: `${baseA}/health`,
        openapiUrl: `${baseA}/openapi.json`,
        tags: ["billing", "core", "money"],
      }),
    },
    token,
  );
  log("bumped billing manifest", { ok: true });

  const list = (await api("/services?q=ser", {}, token)) as {
    count: number;
    items: Array<{ id: string; name: string; version: number; tier: string }>;
  };
  log("search 'ser'", {
    count: list.count,
    items: list.items.map((i) => ({
      id: i.id,
      name: i.name,
      version: i.version,
      tier: i.tier,
    })),
  });

  const versions = await api("/services/billing-service/versions", {}, token);
  log("billing-service versions", versions);

  const openapi1 = (await api(
    "/services/billing-service/openapi",
    {},
    token,
  )) as { source: string; doc: { info: { title: string } } };
  log("openapi (origin)", { source: openapi1.source, title: openapi1.doc.info.title });

  const openapi2 = (await api(
    "/services/billing-service/openapi",
    {},
    token,
  )) as { source: string };
  log("openapi (cached)", { source: openapi2.source });

  const rollup = (await api("/health-rollup", {}, token)) as {
    total: number;
    summary: Record<string, number>;
    results: Array<{ name: string; status: string; latencyMs?: number }>;
  };
  log("health rollup", {
    total: rollup.total,
    summary: rollup.summary,
    results: rollup.results.map((r) => ({
      name: r.name,
      status: r.status,
      latencyMs: r.latencyMs,
    })),
  });

  const playground = await api(
    "/services/billing-service/playground",
    {
      method: "POST",
      body: JSON.stringify({
        method: "POST",
        path: "/echo",
        headers: { "x-trace-id": "trace-abc-123" },
        body: { ping: true, n: 42 },
      }),
    },
    token,
  );
  log("playground call", playground);

  upstreamA.close();
  upstreamB.close();
  log("done", { ok: true });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
