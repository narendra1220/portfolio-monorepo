import type { ProjectCaseStudy } from "@portfolio/shared-types";

export const observabilityPlatform: ProjectCaseStudy = {
  slug: "observability-platform",
  title: "Observability Platform",
  tagline:
    "OpenTelemetry → collector → ClickHouse trace/metric store with a dependency graph and trace explorer.",
  status: "shipped",
  inspiredBy: ["Grafana Tempo", "SigNoz", "Honeycomb", "Datadog"],
  stack: [
    "TypeScript",
    "Node.js",
    "ClickHouse",
    "Redis",
    "OpenTelemetry",
    "Prometheus",
    "Grafana",
    "Docker",
  ],
  metrics: [
    { label: "Tail-sampling kept rate (sim)", value: "3 / 12 traces", hint: "1 error + 1 slow + 1 probabilistic@10%" },
    { label: "Spans accepted (sim)", value: "36 (3 svcs × 12 traces)", hint: "OTLP JSON receiver" },
    { label: "Trace flush latency", value: "~3-4s", hint: "bufferHoldMs=3000, flushInterval=1000" },
    { label: "Service map", value: "3 nodes / 2 edges", hint: "Materialized from kept traces" },
  ],
  links: [
    { label: "Source", href: "https://github.com/your-handle/portfolio-monorepo/tree/main/apps/observability", kind: "github" },
    { label: "README", href: "https://github.com/your-handle/portfolio-monorepo/blob/main/apps/observability/README.md", kind: "docs" },
  ],
  overview:
    "An observability backend that accepts OTLP from any OpenTelemetry SDK, runs spans through a collector for enrichment and sampling, and lands them in ClickHouse. A query API on top serves a trace explorer, a service dependency graph, latency heatmaps, and an alerts engine.",
  problem:
    "Datadog at scale is a six-figure line item. Open-source stacks (Prometheus + Loki + Tempo) work but force engineers to context-switch across three UIs. The opportunity: a single ClickHouse-backed store, one query language, one UI, and the operational simplicity to self-host.",
  architecture: {
    summary:
      "OTLP gRPC ingress → OTel collector (tail-sampling + resource enrichment) → Kafka or Redis Streams buffer → consumer that batch-inserts into ClickHouse (spans, metrics, logs tables). The query API translates UI requests into ClickHouse SQL with safety guards (max scan rows, timeouts). The dependency graph is materialized hourly from a span aggregation.",
    mermaid: `flowchart LR
  APPS[Apps with OTel SDKs] -- OTLP --> COL[OTel collector]
  COL --> BUF[(Redis Streams / Kafka)]
  BUF --> ING[Ingester batch]
  ING --> CH[(ClickHouse)]
  CH --> API[Query API]
  API --> UI[Trace explorer / Service map]
  CH --> ALERT[Alert engine]
  ALERT --> NOTIFY[PagerDuty / Slack]`,
    components: [
      { name: "Collector", purpose: "OTLP ingestion, attribute enrichment, tail-sampling by traceId hash + error/latency rules." },
      { name: "Ingester", purpose: "Drains the buffer, batches into ClickHouse with 1s/10k rows windows." },
      { name: "ClickHouse schema", purpose: "spans (MergeTree, ORDER BY service, time), metrics (SummingMergeTree), logs (MergeTree)." },
      { name: "Query API", purpose: "Typed query builder with safety caps; common operations precomputed." },
      { name: "Service map", purpose: "Hourly MV aggregating call edges + p50/p99/error% per (caller→callee)." },
      { name: "Alert engine", purpose: "Polled queries on rolling windows; routes to PagerDuty/Slack with dedup." },
    ],
  },
  tradeoffs: [
    {
      decision: "ClickHouse over Tempo+Mimir+Loki",
      rationale: "Single store, one query language, much lower op cost at our scale.",
      alternative: "Specialized stores per signal. Better long-term retention story, more components to run.",
    },
    {
      decision: "Tail-sampling at the collector",
      rationale: "Sample based on full-trace properties (errors, latency) not just headers. Keeps the interesting 5%.",
      alternative: "Head-sampling at the SDK. Cheaper but loses signal on rare errors.",
    },
    {
      decision: "Materialized views for service map / RED metrics",
      rationale: "UI queries don't scan raw spans. Map renders in <1s on billions of rows.",
      alternative: "On-the-fly aggregation. Honest, slow under load.",
    },
  ],
  lessons: [
    "ClickHouse partition keys are the single biggest perf lever; toDate(time) is almost always right for spans.",
    "Tail-sampling needs a finite buffer or it OOMs at burst; use a bounded ring with eviction.",
    "Don't store log lines in the spans table; you'll triple the row size and lose columnar speed.",
    "Cardinality of `service.version` will kill your dashboards. Cap and warn at write time.",
  ],
  api: [
    { method: "POST", path: "/v1/traces", description: "OTLP gRPC and HTTP/protobuf ingestion." },
    { method: "GET", path: "/api/services", description: "List services seen in the last N days." },
    { method: "GET", path: "/api/services/:name/map", description: "Service dependency graph with RED metrics per edge." },
    { method: "GET", path: "/api/traces/:traceId", description: "Full trace tree." },
    { method: "GET", path: "/api/traces/search", description: "Search by service, operation, duration, error, tag filters." },
    { method: "POST", path: "/api/alerts", description: "Define query-based alert with notifier targets." },
  ],
  schema: [
    {
      collection: "spans  (ClickHouse, ORDER BY (service, toDate(time)))",
      fields: [
        { name: "trace_id", type: "FixedString(16)" },
        { name: "span_id", type: "FixedString(8)" },
        { name: "parent_id", type: "FixedString(8)" },
        { name: "service", type: "LowCardinality(String)" },
        { name: "name", type: "LowCardinality(String)" },
        { name: "kind", type: "Enum8" },
        { name: "time", type: "DateTime64(9)" },
        { name: "duration_ns", type: "UInt64" },
        { name: "status", type: "Enum8" },
        { name: "attrs", type: "Map(LowCardinality(String), String)" },
      ],
    },
    {
      collection: "metrics  (SummingMergeTree)",
      fields: [
        { name: "name", type: "LowCardinality(String)" },
        { name: "service", type: "LowCardinality(String)" },
        { name: "labels", type: "Map(LowCardinality(String), String)" },
        { name: "value", type: "Float64" },
        { name: "ts", type: "DateTime" },
      ],
    },
    {
      collection: "service_map_hourly  (MV)",
      fields: [
        { name: "caller", type: "LowCardinality(String)" },
        { name: "callee", type: "LowCardinality(String)" },
        { name: "hour", type: "DateTime" },
        { name: "calls", type: "UInt64" },
        { name: "errors", type: "UInt64" },
        { name: "p99_ms", type: "Float32" },
      ],
    },
  ],
  deployment:
    "Collector + ingester run as a DaemonSet near app pods (UDP loss matters). ClickHouse runs as a 3-node replicated cluster behind a CHProxy. Query API is stateless; HPA on CPU.",
  scalability: [
    "Write path scales by partition count and number of ingester pods; ClickHouse merges absorb burstiness.",
    "Read path is keyed: `service + time` is always in the ORDER BY tuple; queries that filter on both stay cheap.",
    "Tail-sampling keeps storage growth roughly linear in *interesting* traffic, not raw traffic.",
  ],
  security: [
    "Multi-tenant isolation by tenant_id column + row policy.",
    "Query API enforces per-tenant time-range caps to prevent unbounded scans.",
    "Ingest auth via per-tenant tokens validated at the collector edge.",
  ],
  future: [
    "Profiles signal (pprof) as a fourth signal alongside metrics/traces/logs.",
    "Adaptive sampling: per-service error-budget aware sampling rates.",
    "Trace-to-log correlation in the UI without leaving the view.",
  ],
  performance: [
    { label: "Tail sampling decision", value: "Pure function", hint: "decide(spans, policy) -> {keep, reason}" },
    { label: "Service map update", value: "Mongo aggregation pipeline", hint: "No app-side read-modify-write race" },
    { label: "Rolling avg correctness", value: "$ifNull-protected", hint: "Aggregation arithmetic on missing fields -> null bug caught & fixed" },
    { label: "Trace assembly", value: "In-memory bucket, drainIdle(holdMs)", hint: "Buffer interface isolates Redis-backed future impl" },
  ],
  folderStructure: `apps/observability/
  src/
    config.ts                  env config
    types.ts                   Span, Log, Trace, ServiceNode, ServiceEdge
    mongo.ts                   spans, logs, traces, services, edges + indexes
    otlp/parse.ts              OTLP JSON -> SpanDoc[]
    ingest/buffer.ts           in-memory trace assembly
    sampling/
      tail.ts                  decide(spans, policy) -> {keep, reason}
      worker.ts                interval flusher
    storage/
      spans.ts                 trace writes + search
      services.ts              rolling-avg nodes + parent->child edges
    rest/app.ts                OTLP receivers + query API + /stats
    bin/
      server.ts                single HTTP entry
      generator.ts             synthetic frontend->api->db trace producer`,
};
