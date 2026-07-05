import type { ProjectCaseStudy } from "@portfolio/shared-types";

export const developerPortal: ProjectCaseStudy = {
  slug: "developer-portal",
  title: "Developer Portal",
  tagline:
    "One front door for every internal API: aggregated Swagger, interactive playground, key management, usage analytics.",
  status: "shipped",
  inspiredBy: ["Stripe Docs", "Backstage", "Postman", "Readme.io"],
  stack: [
    "TypeScript",
    "Next.js",
    "Node.js",
    "Express",
    "MongoDB",
    "Redis",
    "Docker",
  ],
  metrics: [
    { label: "Services registered (sim)", value: "2", hint: "Two in-proc upstreams in simulator" },
    { label: "Health rollup latency", value: "~8 ms / svc", hint: "Concurrent /health fanout, loopback" },
    { label: "Playground round trip", value: "~20 ms", hint: "Portal -> upstream -> response" },
    { label: "OpenAPI cache hit", value: "1 Redis GET", hint: "SWR-cached per service ID" },
  ],
  links: [
    { label: "Live demo", href: "/demos/developer-portal", kind: "demo" },
    { label: "Source", href: "https://github.com/your-handle/portfolio-monorepo/tree/main/apps/developer-portal", kind: "github" },
    { label: "README", href: "https://github.com/your-handle/portfolio-monorepo/blob/main/apps/developer-portal/README.md", kind: "docs" },
  ],
  overview:
    "A portal where any internal team can register a service, publish its OpenAPI spec, and have it appear with auto-generated docs, an interactive playground, and observable usage. Developers discover APIs, create scoped keys, and see their own request analytics without filing a ticket.",
  problem:
    "API discoverability is the silent productivity killer at growing companies. Each team publishes its own Swagger UI on a random port. Customers can't find anything, and platform teams can't track adoption.",
  architecture: {
    summary:
      "A service registry stores OpenAPI specs and metadata in MongoDB. The Next.js portal renders docs from those specs and proxies playground requests through a gateway that injects the user's key and records usage. Analytics roll up hourly into Redis sorted sets for dashboards.",
    mermaid: `flowchart LR
  TEAMS[Service teams] -- push spec --> REG[Registry API]
  REG --> M[(MongoDB: services + specs)]
  PORTAL[Next.js portal] -- fetch spec --> REG
  USERS[Developers] --> PORTAL
  PORTAL -- 'try it' --> GW[Playground gateway]
  GW -- record usage --> R[(Redis)]
  GW --> UPSTREAM[Upstream service]
  R --> DASH[Usage dashboard]`,
    components: [
      { name: "Registry API", purpose: "POST /services/:id/spec with signed CI token. Validates OpenAPI 3.x." },
      { name: "Portal UI", purpose: "Server-rendered docs from registered specs; per-endpoint sandbox." },
      { name: "Playground gateway", purpose: "Auth-injecting proxy with per-(user, endpoint) rate limit and usage capture." },
      { name: "Key manager", purpose: "Self-serve key creation with prefix preview and instant revoke." },
      { name: "Usage aggregator", purpose: "Hourly rollup; sorted-set top-N consumers per endpoint." },
    ],
  },
  tradeoffs: [
    {
      decision: "SSR docs over fully static",
      rationale: "Specs change daily; static rebuilds add a CI step. SSR + CDN = fresh and fast.",
      alternative: "Pre-render at CI. Simpler caching, slower iteration.",
    },
    {
      decision: "Playground hits real upstreams, not mocks",
      rationale: "Developers trust what they ran. Mocks drift and become wrong documentation.",
      alternative: "Mock server. Faster, less honest.",
    },
    {
      decision: "Per-prefix key visibility (`sk_live_abc...****`)",
      rationale: "Users can identify the right key in lists without exposing the full secret.",
      alternative: "Hide entirely. Users create duplicates because they can't tell them apart.",
    },
  ],
  lessons: [
    "Specs lie. Validate them in CI against generated server stubs.",
    "Treat the playground as production traffic with respect to rate limits; otherwise it becomes a load-test source.",
    "Service ownership metadata in the registry is the single most-asked field on every escalation.",
  ],
  api: [
    { method: "POST", path: "/api/services", description: "Register a service: name, owner, repo, env URLs." },
    { method: "POST", path: "/api/services/:id/spec", description: "Upload OpenAPI; replaces 'latest', archives prior." },
    { method: "GET", path: "/api/services/:id/docs", description: "Resolved docs document with examples." },
    { method: "POST", path: "/api/keys", description: "Create scoped API key (returned once)." },
    { method: "GET", path: "/api/usage", description: "Per-key/endpoint usage time series." },
    { method: "POST", path: "/playground/:serviceId/*", description: "Proxy to upstream with key injection." },
  ],
  schema: [
    {
      collection: "services",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "name", type: "string" },
        { name: "owner", type: "object", note: "{ team, slackChannel, oncallUrl }" },
        { name: "repo", type: "string" },
        { name: "envs", type: "object", note: "{ env: { baseUrl, healthUrl } }" },
        { name: "latestSpecVersion", type: "string" },
      ],
    },
    {
      collection: "specs",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "serviceId", type: "ObjectId" },
        { name: "version", type: "string" },
        { name: "openapi", type: "json" },
        { name: "uploadedAt", type: "Date" },
      ],
    },
    {
      collection: "api_keys",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "userId", type: "ObjectId" },
        { name: "prefix", type: "string", note: "First 8 chars, public" },
        { name: "hash", type: "string", note: "BLAKE3(key)" },
        { name: "scopes", type: "array" },
        { name: "createdAt", type: "Date" },
        { name: "revokedAt", type: "Date | null" },
      ],
    },
  ],
  deployment:
    "Portal (Next.js SSR + CDN) + Registry API + Playground gateway as three pods. MongoDB for source-of-truth, Redis for rate limit + usage aggregation. Specs are content-addressed and stored gzipped.",
  scalability: [
    "Portal pages are SSR + cached at the edge; cache key includes spec version.",
    "Playground is the bottleneck; rate-limit per (user, endpoint) and reuse the API gateway primitives.",
    "Usage rollup runs as a single leader-elected job per hour.",
  ],
  security: [
    "Spec upload requires a service-scoped CI token (short-lived, repo-bound).",
    "Keys hashed at rest; raw value shown only at creation, with a copy-once UX.",
    "Playground requests are tagged so audit logs can attribute them to the developer, not the service account.",
  ],
  future: [
    "AI-assisted endpoint search ('how do I cancel a subscription?').",
    "Auto-generated TypeScript SDKs per service from the spec on upload.",
    "Linting rules per platform team (e.g., 'every list endpoint must be paginated').",
  ],
  performance: [
    { label: "OpenAPI cold fetch -> warm", value: "1 Redis GET", hint: "SWR with TTL invalidation on manifest bump" },
    { label: "Health rollup 2 services", value: "~16 ms total", hint: "Promise.all fanout, 1.5s per-call timeout" },
    { label: "Manifest upsert (no-op)", value: "0 writes", hint: "JSON-canonical diff check; identical manifest -> no version bump" },
    { label: "Playground proxy", value: "Header allow-list + 8s timeout", hint: "Hop-by-hop + cookie headers stripped" },
  ],
  folderStructure: `apps/developer-portal/
  src/
    config.ts             env config + cache keys
    types.ts              ServiceManifest, Service, HealthResult, PlaygroundRequest
    auth.ts               HS256 JWT
    mongo.ts              services + versions
    redis.ts              ioredis factory
    catalog/validator.ts  zod manifest schema
    repo/services.ts      upsert + version-bump-on-diff, search, history
    openapi/fetch.ts      Redis-cached fetcher
    health/checker.ts     concurrent health checks
    playground/proxy.ts   header-sanitizing fetch proxy
    rest/app.ts           CRUD + search + openapi + rollup + playground
    bin/
      server.ts           REST entry
      simulate.ts         end-to-end test, 2 in-proc upstreams`,
};
