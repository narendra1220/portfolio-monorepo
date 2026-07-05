import type { ProjectCaseStudy } from "@portfolio/shared-types";

export const apiGateway: ProjectCaseStudy = {
  slug: "api-gateway",
  title: "Production API Gateway",
  tagline:
    "Reverse proxy with JWT/OAuth, per-tenant rate limits, circuit breakers, response caching, and a control plane.",
  status: "shipped",
  inspiredBy: ["Kong", "NGINX", "Netflix Zuul", "Cloudflare"],
  stack: [
    "TypeScript",
    "Node.js",
    "Express",
    "Redis",
    "MongoDB",
    "NGINX",
    "Docker",
    "Prometheus",
    "OpenTelemetry",
  ],
  metrics: [
    { label: "Rate-limit accuracy", value: "exact 5/5 over 12 concurrent", hint: "Lua sliding window verified" },
    { label: "Circuit trip", value: "5 failures @ 50% err rate", hint: "minRequests + errorRate gate" },
    { label: "Circuit recover", value: "1 half-open probe", hint: "Closes after first successful probe" },
    { label: "Added latency", value: "~1.5 ms loopback", hint: "Streaming forward, no body buffering" },
  ],
  links: [
    { label: "Source", href: "https://github.com/your-handle/portfolio-monorepo/tree/main/apps/api-gateway", kind: "github" },
    { label: "README", href: "https://github.com/your-handle/portfolio-monorepo/blob/main/apps/api-gateway/README.md", kind: "docs" },
  ],
  overview:
    "A horizontally scalable API gateway that sits between clients and a fleet of backend services. The data plane (Node) handles auth, routing, rate limiting, caching, and circuit breaking. The control plane (a small Express + MongoDB app) lets operators define routes, upstreams, plugins, and credentials without redeploying the data plane.",
  problem:
    "A growing backend fleet means: every team rebuilds auth, rate limiting, retries, and observability in their own service. The result is inconsistent behavior, scattered SLO violations, and per-service security audits. The gateway centralizes cross-cutting concerns and gives platform engineers one place to enforce policy.",
  architecture: {
    summary:
      "Stateless data-plane nodes pull config from Redis (refreshed via pub/sub on control-plane changes). Each request flows through an ordered middleware chain: TLS termination at NGINX → auth → rate limit → cache lookup → route resolution → upstream proxy with circuit breaker and retry → response transform → emit metrics & spans.",
    mermaid: `flowchart LR
  C[Client] --> N[NGINX]
  N --> DP1[Gateway node]
  N --> DP2[Gateway node]
  DP1 --> R[(Redis: config + cache + rate limit)]
  DP1 --> UP1[Upstream A]
  DP1 --> UP2[Upstream B]
  CP[Control plane API] --> M[(MongoDB: routes/plugins/credentials)]
  CP -- publish 'config:changed' --> R
  R -- subscribe --> DP1
  DP1 --> OTEL[OTel collector]
  OTEL --> PROM[(Prometheus)]
  OTEL --> JAEGER[(Tempo/Jaeger)]`,
    components: [
      { name: "Data plane (Node)", purpose: "High-throughput request handling. No mutable global state." },
      { name: "Control plane (Express)", purpose: "CRUD on routes/plugins/credentials. Publishes config-change events." },
      { name: "Rate limiter (Lua)", purpose: "Token-bucket per (tenant, route) in a single Redis round trip." },
      { name: "Circuit breaker", purpose: "Per upstream: closed/open/half-open with exponential probe window." },
      { name: "Cache", purpose: "Vary-aware response cache in Redis with stale-while-revalidate." },
      { name: "Auth", purpose: "JWT (HS/RS), OAuth introspection, API key with hashed lookup." },
    ],
  },
  tradeoffs: [
    {
      decision: "Single Lua script per request (rate-limit + counter)",
      rationale: "Atomic, single Redis RTT. Beats multi-step MULTI/EXEC and avoids race windows.",
      alternative: "Sliding-window in app code. Race-prone under burst.",
    },
    {
      decision: "Config in Redis (with Mongo as source of truth)",
      rationale: "Hot path reads must be a single Redis GET. Mongo is for the admin UI.",
      alternative: "Read directly from Mongo with a cache. Adds eviction complexity.",
    },
    {
      decision: "Retry budget, not unlimited retries",
      rationale: "Retries amplify outages. Budgets (10% of total RPS) prevent retry storms.",
      alternative: "Per-request retry count only. Looks safer, isn't.",
    },
  ],
  lessons: [
    "Retries without budget kill upstreams faster than no retries at all.",
    "Circuit breakers must be per-upstream, not per-route, or you blackhole healthy paths.",
    "Header-rewrite middleware is a foot-gun; require explicit allow-list.",
    "Hash API keys on write, never store plaintext. Reject bcrypt and use BLAKE3/SHA-256 + HMAC for lookup speed.",
  ],
  api: [
    { method: "POST", path: "/admin/routes", description: "Register a route: { path, methods, upstreamId, plugins[] }" },
    { method: "GET", path: "/admin/routes", description: "List routes; supports filtering and pagination." },
    { method: "POST", path: "/admin/upstreams", description: "Register upstream pool with healthcheck + weights." },
    { method: "POST", path: "/admin/credentials", description: "Issue API key (returned once)." },
    { method: "POST", path: "/admin/rate-limits", description: "Per-(tenant, route) bucket configuration." },
    { method: "GET", path: "/health", description: "Gateway liveness; checks Redis + control plane." },
    { method: "*", path: "/* (data plane)", description: "Any path matched by a registered route is proxied." },
  ],
  schema: [
    {
      collection: "routes",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "match", type: "object", note: "{ path, methods, host? }" },
        { name: "upstreamId", type: "ObjectId" },
        { name: "plugins", type: "array", note: "Ordered: auth, rateLimit, cache, transform" },
        { name: "enabled", type: "bool" },
      ],
    },
    {
      collection: "upstreams",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "name", type: "string" },
        { name: "targets", type: "array", note: "{ url, weight }" },
        { name: "healthcheck", type: "object", note: "{ path, intervalMs, threshold }" },
        { name: "circuit", type: "object", note: "{ errorRate, windowMs, halfOpenProbes }" },
      ],
    },
    {
      collection: "credentials",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "tenantId", type: "ObjectId" },
        { name: "kind", type: "enum", note: "apiKey | jwtIssuer | oauthClient" },
        { name: "keyHash", type: "string", note: "BLAKE3 (apiKey only)" },
        { name: "scopes", type: "array" },
      ],
    },
  ],
  deployment:
    "Data plane behind NGINX with TLS termination; horizontal pod autoscale on CPU + request latency. Control plane is single-region active; Redis is replicated. Blue/green for data plane via NGINX upstream weights.",
  scalability: [
    "Data plane is stateless: scale on CPU.",
    "Redis is the hot dependency. Use a read-replica for cache GETs; writes (rate limit increments) hit primary.",
    "Plan for ~1.5 ms of gateway overhead. Above 50k qps consider per-node local LRU in front of Redis for routes.",
  ],
  security: [
    "TLS 1.3 only at the edge; HSTS preload.",
    "JWT keys rotated via JWKS endpoint; control plane caches keys with TTL.",
    "API keys hashed (BLAKE3 + per-tenant pepper).",
    "Rate limits include a global circuit (max 50k qps per tenant) to bound outage blast-radius.",
  ],
  future: [
    "WASM plugins (Proxy-Wasm spec) so teams can ship custom filters without forking.",
    "gRPC pass-through with metadata-aware rate limiting.",
    "Per-route SLO objects with auto-paging when budget burns >2x.",
  ],
  performance: [
    { label: "Sliding-window rate limit", value: "1 Lua round trip", hint: "ZREMRANGEBYSCORE + ZCARD + ZADD + PEXPIRE atomic" },
    { label: "Circuit open detection", value: "5 reqs (minRequests) at 50% errors", hint: "Verified in simulator" },
    { label: "Circuit close on recovery", value: "1 half-open probe", hint: "openMs 5s -> half_open -> closed" },
    { label: "Body buffering", value: "Streamed via http.request", hint: "Request body capped 4 MiB; response streamed" },
  ],
  folderStructure: `apps/api-gateway/
  src/
    config.ts                env config + redis keys
    types.ts                 RouteCfg, RateLimit, CircuitStats, AccessLog
    auth.ts                  HS256 JWT consumer
    redis.ts                 ioredis factory
    routes/
      registry.ts            HSET + PUBLISH, subscriber refreshes
      router.ts              longest-prefix match
    middleware/
      rateLimit.ts           Lua sliding window
      circuit.ts             closed/open/half_open per backend
    metrics/counters.ts      Prometheus text exposition
    proxy/
      forwarder.ts           streaming http.request, header allow-list
      handler.ts             auth -> rl -> circuit -> forward -> retry -> log
    control/rest.ts          control plane: routes CRUD, /circuit, /metrics
    bin/
      server.ts              proxy + control servers
      simulate.ts            end-to-end test`,
};
