import type { ProjectCaseStudy } from "@portfolio/shared-types";

export const featureFlags: ProjectCaseStudy = {
  slug: "feature-flag-platform",
  title: "Feature Flag Platform",
  tagline:
    "Targeted rollouts, percentage ramps, environment overrides, and sub-millisecond SDK evaluation.",
  status: "shipped",
  inspiredBy: ["LaunchDarkly", "Unleash", "Flagsmith"],
  stack: [
    "TypeScript",
    "Node.js",
    "Express",
    "Redis",
    "MongoDB",
    "Docker",
    "Prometheus",
  ],
  metrics: [
    { label: "SDK eval", value: "~0.05 ms", hint: "Local in-process ruleset; map lookup + condition eval" },
    { label: "Flag flip → SDK notice", value: "≤ 500 ms loopback", hint: "Redis PUBLISH → SSE → SDK refetch verified in simulator" },
    { label: "Rollout distribution (200 users, 50%)", value: "103 / 97", hint: "FNV1a sticky bucket" },
    { label: "Ruleset version op", value: "1 round trip", hint: "findOneAndUpdate $inc atomic" },
  ],
  links: [
    { label: "Live demo", href: "/demos/feature-flags", kind: "demo" },
    { label: "Source", href: "https://github.com/your-handle/portfolio-monorepo/tree/main/apps/feature-flags", kind: "github" },
    { label: "README", href: "https://github.com/your-handle/portfolio-monorepo/blob/main/apps/feature-flags/README.md", kind: "docs" },
  ],
  overview:
    "A multi-tenant feature flag service with an admin dashboard, environment-scoped overrides, percentage rollouts with sticky bucketing, and SDKs that evaluate locally to keep request paths fast. Changes propagate via SSE to subscribed SDKs in under a few seconds.",
  problem:
    "Teams either ship without flags (and ship blast-radius outages) or build per-service flag YAMLs (and never deprecate them). A central platform with deletion lints, ownership, and rollout history makes flags safe enough to use everywhere.",
  architecture: {
    summary:
      "Admin API writes to MongoDB. A 'ruleset compiler' takes the human flag definition and emits a deterministic compact ruleset cached in Redis per (tenant, environment, version). SDKs subscribe to an SSE stream; on flag change, they receive the new ruleset version, fetch it from Redis-backed CDN edge, and atomically swap in-process.",
    mermaid: `flowchart LR
  ADMIN[Admin UI] --> API[Admin API]
  API --> M[(MongoDB: flags + targeting)]
  API --> COMP[Ruleset compiler]
  COMP --> R[(Redis: ruleset by version)]
  COMP -- publish --> BUS[Redis Pub/Sub]
  SDK1[App SDK] -- SSE --> EDGE[SSE/edge service]
  EDGE -- subscribe --> BUS
  EDGE -- get ruleset --> R
  SDK1 -- evaluate locally --> SDK1`,
    components: [
      { name: "Admin API", purpose: "CRUD flags, environments, segments, audit log." },
      { name: "Ruleset compiler", purpose: "Normalizes targeting rules; emits versioned bytecode ruleset." },
      { name: "Edge service", purpose: "SSE endpoint; pushes version bumps to connected SDKs." },
      { name: "SDKs (Node, Browser, Go)", purpose: "Hold the compiled ruleset in memory; evaluate without network." },
      { name: "Bucketer", purpose: "FNV1a(userId + flagKey) % 10000 → sticky percentage rollout." },
    ],
  },
  tradeoffs: [
    {
      decision: "Local SDK eval over server-side eval",
      rationale: "Hot paths can't afford a network call. Push the ruleset, eval in-process.",
      alternative: "Server-side eval (single hop). Simpler to reason about, kills tail latency.",
    },
    {
      decision: "SSE over WebSocket",
      rationale: "Half-duplex is what we need; SSE survives proxies and corporate networks better.",
      alternative: "WebSocket with custom ping. More moving parts.",
    },
    {
      decision: "Versioned rulesets in Redis",
      rationale: "Idempotent fetch; SDKs can re-fetch on reconnect by version without admin DB load.",
      alternative: "Stream every change. Hard to reconcile when an SDK reconnects after hours offline.",
    },
  ],
  lessons: [
    "Sticky bucketing must be deterministic across SDK languages — pin the hash function and document it.",
    "An audit log is the difference between a flag platform and a flag time-bomb.",
    "Deprecation reminders ('this flag has been at 100% for 30 days') are the most valued admin feature, not the prettiest dashboard.",
  ],
  api: [
    { method: "POST", path: "/api/flags", description: "Create a flag with default, environments, targeting rules." },
    { method: "PATCH", path: "/api/flags/:key", description: "Update targeting/rollout; bumps ruleset version." },
    { method: "GET", path: "/api/flags/:key/eval", description: "Server-side eval for non-SDK clients." },
    { method: "GET", path: "/sdk/v1/ruleset/:env/:version", description: "Fetch compiled ruleset (signed, cacheable)." },
    { method: "SSE", path: "/sdk/v1/stream/:env", description: "Push channel for version bumps." },
  ],
  schema: [
    {
      collection: "flags",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "key", type: "string", note: "tenant-scoped unique" },
        { name: "tenantId", type: "ObjectId" },
        { name: "type", type: "enum", note: "boolean | string | number | json" },
        { name: "default", type: "any" },
        { name: "environments", type: "object", note: "{ envKey: { enabled, rules[], rolloutPct } }" },
        { name: "owner", type: "string" },
        { name: "updatedAt", type: "Date" },
      ],
    },
    {
      collection: "segments",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "key", type: "string" },
        { name: "rules", type: "array", note: "predicate AST" },
      ],
    },
    {
      collection: "flag_audit",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "flagKey", type: "string" },
        { name: "actor", type: "string" },
        { name: "diff", type: "object" },
        { name: "ts", type: "Date" },
      ],
    },
  ],
  deployment:
    "Admin API + Edge service in two pools (admin private, edge public). Redis is hot path; MongoDB is for admin reads. CDN in front of `/sdk/v1/ruleset/*` (immutable + signed).",
  scalability: [
    "SDK connections are sticky to edge pods; scale edge linearly with connection count (~10k/pod).",
    "Ruleset fetch is CDN-able because versions are immutable.",
    "Eval is local: scales infinitely on the client side.",
  ],
  security: [
    "Per-tenant signed rulesets; SDK verifies signature before adoption.",
    "Admin actions require role + scope; sensitive flags (kill switches) require 2-person approval.",
  ],
  future: [
    "Experiment platform on top of flags (variant exposure → metrics pipeline).",
    "Static analysis of flag usage in code to drive deprecation.",
    "Edge eval at CDN workers for ultra-low latency cohort assignment.",
  ],
  performance: [
    { label: "End-to-end flip → SDK swap", value: "≤ 500 ms", hint: "Loopback Redis + SSE" },
    { label: "200-user rollout fairness (50%)", value: "103 / 97 split", hint: "FNV1a sticky bucket" },
    { label: "SSE message size", value: "~50 B", hint: "Only {env, version} per push" },
    { label: "Eval flag path", value: "Map.get + N condition checks", hint: "Zero allocations on hot path" },
  ],
  folderStructure: `apps/feature-flags/
  src/
    config.ts           env config + redis keys
    types.ts            Flag, Condition, Rule, CompiledFlag, Ruleset
    auth.ts             HS256 JWT
    mongo.ts            flags, audit, meta + indexes
    redis.ts            ioredis factory
    compiler/
      bucket.ts         FNV1a + inRollout
      compile.ts        flag + env + version -> Ruleset
      eval.ts           ruleset + ctx -> EvalResult
    repo/               flags, audit, meta
    bus/publisher.ts    SET + PUBLISH ruleset bump
    sse/edge.ts         /sse/:env + ruleset fetch
    rest/app.ts         admin REST + /eval
    sdk/node.ts         FeatureFlagClient (fetch + SSE)
    bin/
      server.ts         REST + SSE process
      simulate.ts       end-to-end flag flip test`,
};
