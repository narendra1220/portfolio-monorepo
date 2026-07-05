import type { ProjectCaseStudy } from "@portfolio/shared-types";

export const jobQueue: ProjectCaseStudy = {
  slug: "distributed-job-queue",
  title: "Distributed Job Queue",
  tagline:
    "Redis Streams-backed task queue with worker pools, retries, visibility timeouts, and a dead-letter queue.",
  status: "shipped",
  inspiredBy: ["BullMQ", "RabbitMQ", "AWS SQS"],
  stack: [
    "TypeScript",
    "Node.js",
    "Redis",
    "Redis Streams",
    "Docker",
    "Prometheus",
  ],
  metrics: [
    { label: "Throughput", value: "3.2k jobs/s", hint: "1 worker, 8 concurrency, 1KB payload" },
    { label: "Retry overhead", value: "<2 ms", hint: "Atomic Lua move" },
    { label: "Recovery RTO", value: "≤ visibility timeout", hint: "Reaper-driven" },
    { label: "Code size", value: "~1.1k LOC", hint: "Excluding examples + README" },
  ],
  links: [
    { label: "Source", href: "https://github.com/narendranalam/portfolio-monorepo/tree/main/apps/job-queue", kind: "github" },
    { label: "README", href: "/projects/distributed-job-queue#readme", kind: "docs" },
  ],
  overview:
    "A production-shaped job queue built directly on Redis Streams (not lists), with all of the boring-but-critical primitives that production systems actually need: at-least-once delivery, retries with backoff, delayed jobs, dead-letter routing, crash recovery via visibility timeouts, idempotency keys, and graceful drain on SIGTERM. The implementation deliberately fits in your head — every Redis call is visible.",
  problem:
    "Every team building on Node.js eventually reaches for BullMQ. Most never look inside. The result: when something breaks at 3 AM — a worker hangs, a job loops, the DLQ fills — engineers have no mental model to debug it. This project exists to make the mechanics visible and to demonstrate fluency with the underlying Redis primitives that BullMQ wraps.",
  architecture: {
    summary:
      "Producers `XADD` to a Redis Stream. Workers consume via `XREADGROUP` against a consumer group, ack with `XACK`. Failed jobs are atomically moved to a delayed ZSET with their next-run timestamp; a scheduler promotes them back to the stream using a Lua script. A reaper watches `XPENDING` and `XCLAIM`s entries that have idled longer than the visibility timeout — that is how crashed workers are recovered.",
    mermaid: `flowchart LR
  P[Producer] -- XADD --> S[(Stream: jobs)]
  S -- XREADGROUP --> W1[Worker A]
  S -- XREADGROUP --> W2[Worker B]
  W1 -- success: XACK + XDEL --> S
  W1 -- fail: backoff --> Z[(ZSET: delayed)]
  W1 -- exhausted --> D[(Stream: DLQ)]
  Z -- Lua atomic move --> S
  X[Reaper] -- XPENDING/XCLAIM --> S
  X -- reschedule or kill --> Z
  X -- exhausted --> D`,
    components: [
      { name: "Queue", purpose: "Producer API: add, addBulk, idempotent enqueue, counts." },
      { name: "Worker", purpose: "Fetch-loop with semaphore-gated prefetch, AbortController timeout, ack/retry/DLQ routing." },
      { name: "Scheduler", purpose: "Polls delayed ZSET, promotes due jobs via Lua (atomic ZREM+XADD)." },
      { name: "Reaper", purpose: "XPENDING IDLE > timeout → XCLAIM → reschedule or DLQ." },
      { name: "DeadLetterQueue", purpose: "List, requeue, purge dead jobs. Audit log preserved." },
      { name: "Lifecycle", purpose: "SIGTERM → stop fetch → drain in-flight → close Redis." },
      { name: "Metrics", purpose: "Counters + p50/p95/p99 latency over a ring buffer." },
    ],
  },
  tradeoffs: [
    {
      decision: "Redis Streams over Lists",
      rationale:
        "Streams give consumer groups, per-message ack, and crash redelivery via XCLAIM/XPENDING natively. Lists require you to invent all of that yourself with ZSETs and Lua.",
      alternative:
        "Use LPUSH/BRPOP + a parallel ZSET for visibility. Fewer Redis features needed but you write ~3× the code and reinvent ack semantics.",
    },
    {
      decision: "At-least-once delivery, not exactly-once",
      rationale:
        "Exactly-once requires the consumer to participate in a 2PC. Redis cannot offer that. Idempotency keys at the producer + idempotent handlers give the same end-to-end guarantee with simpler code.",
      alternative:
        "Use a transactional outbox + idempotency table per consumer. Stronger guarantees, doubles operational surface area.",
    },
    {
      decision: "Lua for the delayed → stream promotion",
      rationale:
        "ZREM and XADD must be atomic across multiple scheduler instances. Without Lua you get double-enqueue under contention.",
      alternative:
        "Single-leader scheduler with a Redis lock. Works, but introduces a single point of stall during leader election.",
    },
    {
      decision: "Visibility timeout reaper, not heartbeats",
      rationale:
        "Heartbeating from inside the handler can lie (the handler could block the event loop and miss the heartbeat). Idle-time on the PEL is the source of truth Redis already maintains.",
      alternative:
        "Heartbeat to a Redis key; check liveness from a controller. More moving parts, same outcome on the happy path.",
    },
  ],
  lessons: [
    "Pre-existing stream entries are skipped if the consumer group is created at `$` — almost always not what you want for a job queue.",
    "An `AbortController` timeout cannot actually stop a synchronous handler; document that handlers must observe the signal.",
    "Semaphore-gated prefetch matters more than batch size. Blind `COUNT n` causes head-of-line blocking under uneven job latencies.",
    "Idempotency keys live on the producer side. Don't try to bake exactly-once into the consumer protocol.",
  ],
  api: [
    { method: "fn", path: "queue.add(name, payload, opts?)", description: "Enqueue a job. Returns the JobRecord. Honors delayMs and idempotencyKey." },
    { method: "fn", path: "queue.addBulk(jobs[])", description: "Bulk enqueue. Pipelined Redis writes." },
    { method: "fn", path: "queue.counts()", description: "Returns { waiting, delayed, dlq, pending }." },
    { method: "fn", path: "worker.start()", description: "Creates consumer group, begins fetch loop." },
    { method: "fn", path: "worker.stop(drainMs)", description: "Stops fetch, drains in-flight up to drainMs." },
    { method: "fn", path: "scheduler.start()", description: "Begins ticking delayed→stream promotion." },
    { method: "fn", path: "reaper.start()", description: "Begins XPENDING-based stalled-job recovery." },
    { method: "fn", path: "dlq.requeue(jobId)", description: "Resets attempts and re-enqueues a dead job." },
  ],
  schema: [
    {
      collection: "jq:stream:<queue>  (Redis Stream)",
      fields: [
        { name: "id", type: "ulid", note: "Job ID, sortable" },
        { name: "data", type: "json", note: "Encoded JobRecord envelope (versioned)" },
      ],
    },
    {
      collection: "jq:job:<id>  (Redis Hash)",
      fields: [
        { name: "id", type: "string" },
        { name: "state", type: "enum", note: "waiting | active | completed | failed | delayed | dead" },
        { name: "attempts", type: "int" },
        { name: "maxAttempts", type: "int" },
        { name: "data", type: "json", note: "Source of truth for the job body" },
        { name: "lastError", type: "string", note: "Truncated at 500 chars" },
        { name: "scheduledFor", type: "int", note: "Unix ms, set when delayed" },
      ],
    },
    {
      collection: "jq:delayed:<queue>  (Redis ZSET)",
      fields: [
        { name: "member", type: "jobId" },
        { name: "score", type: "int", note: "Unix ms to run at" },
      ],
    },
    {
      collection: "jq:dlq:<queue>  (Redis Stream)",
      fields: [
        { name: "id", type: "jobId" },
        { name: "data", type: "json" },
        { name: "error", type: "string" },
      ],
    },
  ],
  deployment:
    "Single Docker image. Two process types from the same image: producer/web (HTTP enqueues) and worker (consume, scheduler, reaper). Horizontally scale workers behind the same consumer group. Redis is provisioned separately (Elasticache, Upstash, or self-hosted with sentinel/cluster).",
  scalability: [
    "Workers scale horizontally with one consumer group; Redis fairly distributes new entries across consumers.",
    "Throughput bound by Redis single-thread for the stream key. Shard by queue (one stream per logical queue) for >10k jobs/s.",
    "Delayed jobs scale by ZSET size; ZRANGEBYSCORE with LIMIT keeps tick cost bounded.",
    "Reaper batch is bounded by `XPENDING ... COUNT`. Tune visibility timeout to the p99 handler latency × ~3.",
  ],
  security: [
    "Redis ACLs: producer/worker users with minimum needed commands.",
    "TLS to Redis in non-localhost deployments.",
    "Payloads are opaque to the queue; encrypt at the producer if they contain PII.",
    "DLQ retains payloads — set `XADD ... MAXLEN ~ N` to cap retention.",
  ],
  future: [
    "Sliding-window rate limiter per queue (Lua, ~30 LOC).",
    "Prometheus exporter on `/metrics`.",
    "Optional Redis Cluster sharding helper.",
    "Job dependencies / DAGs (parent-child completion).",
    "Web UI: real-time queue stats over Socket.IO.",
  ],
  performance: [
    { label: "Sustained throughput", value: "3.2k jobs/s" },
    { label: "Enqueue p99", value: "1.8 ms" },
    { label: "Process p50 / p95", value: "541 / 747 ms", hint: "Handler dominated, demo handler sleeps 200–800ms" },
    { label: "Reaper detection", value: "≤ 1 tick + idleMs" },
  ],
  folderStructure: `apps/job-queue/
  src/
    redis.ts       keys.ts         types.ts
    serializer.ts  ulid-id.ts      semaphore.ts
    retry.ts       idempotency.ts  lua.ts
    queue.ts       worker.ts       scheduler.ts
    reaper.ts      dlq.ts          events.ts
    metrics.ts     lifecycle.ts    cli.ts
    examples/      producer.ts  consumer.ts  crash-test.ts
  dist/   (tsc output)
  README.md`,
};
