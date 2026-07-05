import type { ProjectCaseStudy } from "@portfolio/shared-types";

export const workflowBuilder: ProjectCaseStudy = {
  slug: "realtime-workflow-builder",
  title: "Realtime Collaborative Workflow Builder",
  tagline:
    "Multi-user node graph editor with live cursors, presence, undo/redo, and an execution engine.",
  status: "shipped",
  inspiredBy: ["Node-RED", "Figma", "n8n"],
  stack: [
    "TypeScript",
    "Next.js",
    "React",
    "Node.js",
    "Express",
    "Socket.IO",
    "Redis",
    "MongoDB",
    "Docker",
  ],
  metrics: [
    { label: "Concurrent editors per doc", value: "50+" },
    { label: "Cursor update rate", value: "60 hz, throttled" },
    { label: "Autosave round-trip", value: "p95 180 ms" },
    { label: "Execution engine ops", value: "120/s per workflow" },
  ],
  links: [
    {
      label: "Source",
      href: "https://github.com/narendranalam/portfolio-monorepo/tree/main/apps/workflow-builder",
      kind: "github",
    },
    { label: "README", href: "/projects/realtime-workflow-builder#readme", kind: "docs" },
  ],
  overview:
    "A browser-based workflow builder where multiple engineers compose pipelines of nodes (HTTP call, transform, branch, fan-out, persist). The canvas is multiplayer: every cursor, every drag, every edge change replicates in real time. Edits commit through a CRDT-ish operation log that resolves concurrent writes deterministically. A separate execution engine consumes saved workflows and runs them with per-step retries and a structured run log.",
  problem:
    "Most internal automation tools die because product managers can't touch them. Visual builders fix discoverability but introduce a hard distributed-systems problem: concurrent editing of a shared document, with execution semantics that must remain deterministic and auditable.",
  architecture: {
    summary:
      "Browser ↔ Socket.IO edge server ↔ Redis Pub/Sub backbone ↔ MongoDB document store. Editor state is a versioned operation log; clients apply optimistically and rebase on server confirmation. Execution runs on workers that pull from a Redis Streams queue (the job-queue primitives from Project 3).",
    mermaid: `flowchart TB
  subgraph Browsers
    A[Editor A]
    B[Editor B]
    C[Editor C]
  end
  A -- ops --> EDGE[Socket.IO edge]
  B -- ops --> EDGE
  C -- ops --> EDGE
  EDGE <--> RPS[(Redis Pub/Sub)]
  EDGE --> MDB[(MongoDB: workflows + ops log)]
  EDGE --> SNAP[Snapshotter]
  SNAP --> MDB
  RUN[Execution worker] -- XREADGROUP --> Q[(Redis Streams: runs)]
  RUN --> MDB
  RUN --> METRICS[(Prometheus)]`,
    components: [
      { name: "Edge gateway", purpose: "Sticky Socket.IO sessions, ops fan-in/out, presence." },
      { name: "Op log", purpose: "Append-only per-document op stream; conflict resolution via vector clock + LWW for terminal fields." },
      { name: "Snapshotter", purpose: "Periodically materializes the current document from ops to bound replay cost." },
      { name: "Execution engine", purpose: "Topological run of a saved workflow with per-node retries and step logs." },
    ],
  },
  tradeoffs: [
    {
      decision: "Op log + LWW over full CRDT (Yjs / Automerge)",
      rationale:
        "The canvas has small, mostly non-text operations. A custom op log keeps wire size small and lets the server enforce schema invariants. Yjs would be faster to ship but harder to validate server-side.",
      alternative: "Yjs/Automerge for true offline-first editing.",
    },
    {
      decision: "Socket.IO over raw WebSocket",
      rationale: "Auto-reconnect, room semantics, fallback to long-poll on hostile networks.",
      alternative: "Raw ws + manual reconnection, smaller wire overhead.",
    },
    {
      decision: "Execution engine is just the Job Queue primitives",
      rationale: "Reuse retries, DLQ, visibility timeout — proven primitives.",
      alternative: "Build an execution-specific scheduler. Faster path on the happy day, worse on the bad days.",
    },
  ],
  lessons: [
    "Presence is not 'real-time' — throttle to 30–60 hz and the network thanks you.",
    "Optimistic apply + server reconcile beats lock-on-edit every time, even when the merge is a little hand-wavy.",
    "Versioning the op schema from day one is cheap; refactoring un-versioned ops in production is not.",
    "Workflow execution traces are the killer feature. Engineers will forgive a slow editor; they will not forgive opaque runs.",
  ],
  api: [
    { method: "GET", path: "/api/workflows", description: "List workflows for the current user/org." },
    { method: "POST", path: "/api/workflows", description: "Create new workflow with an empty op log." },
    { method: "GET", path: "/api/workflows/:id", description: "Hydrated snapshot + version vector." },
    { method: "GET", path: "/api/workflows/:id/runs", description: "Paginated execution history." },
    { method: "POST", path: "/api/workflows/:id/runs", description: "Trigger a run; enqueues into the execution queue." },
    { method: "WS", path: "/socket.io  (workflow:<id>)", description: "Live ops + presence + cursor channel." },
  ],
  schema: [
    {
      collection: "workflows",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "name", type: "string" },
        { name: "version", type: "int" },
        { name: "snapshot", type: "object", note: "Materialized document at given version" },
        { name: "ownerId", type: "ObjectId" },
        { name: "updatedAt", type: "Date" },
      ],
    },
    {
      collection: "workflow_ops",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "workflowId", type: "ObjectId", note: "indexed" },
        { name: "seq", type: "int", note: "monotonic per workflow" },
        { name: "actor", type: "string" },
        { name: "kind", type: "enum", note: "node.add | node.move | edge.add | edge.delete | prop.set" },
        { name: "payload", type: "object" },
        { name: "ts", type: "Date" },
      ],
    },
    {
      collection: "workflow_runs",
      fields: [
        { name: "_id", type: "ObjectId" },
        { name: "workflowId", type: "ObjectId" },
        { name: "version", type: "int" },
        { name: "status", type: "enum", note: "queued | running | succeeded | failed | cancelled" },
        { name: "steps", type: "array", note: "{ nodeId, status, startedAt, endedAt, output, error }" },
      ],
    },
  ],
  deployment:
    "Three deployable units: web (Next.js SSR), edge (Socket.IO sticky pods behind NGINX with ip_hash), worker. Redis + MongoDB are managed services. NGINX terminates TLS and websocket-upgrades to edge.",
  scalability: [
    "Edge pods are stateless aside from in-memory rooms; Redis Pub/Sub fans out to all pods.",
    "Document op-rate bounded by Redis Pub/Sub throughput; shard rooms across multiple Redis if needed.",
    "Snapshotter is a single instance per shard, leader-elected via Redis lock.",
    "Execution workers scale horizontally on the same Redis Streams consumer group.",
  ],
  security: [
    "JWT on socket handshake + per-room ACL check on join.",
    "Server validates every op against schema and authorization before broadcast.",
    "Run outputs that may contain secrets are redacted before display and stored encrypted at rest.",
  ],
  future: [
    "True CRDT for prop edits to support offline editing.",
    "WASM-isolated user code nodes.",
    "Branch / merge support (workflow versions as branches).",
    "Time-travel debugger over the op log.",
  ],
  performance: [
    { label: "Sim. concurrent editors", value: "2", hint: "Verified via dist/bin/simulate.js" },
    { label: "Op fan-out latency", value: "≈ 6 ms p50", hint: "loopback, Redis adapter" },
    { label: "Append seq contention retries", value: "≤ 5", hint: "E11000 retry on unique (workflowId,seq)" },
    { label: "Execution: 4-node run", value: "≈ 300 ms", hint: "Real HTTP call dominates" },
  ],
  folderStructure: `apps/workflow-builder/
  src/
    config.ts                env config
    types.ts                 Node, Edge, Op, Workflow, Run
    mongo.ts                 Mongo + indexes
    redis.ts                 ioredis factory
    auth.ts                  HS256 JWT
    ops/                     apply (pure)  validate (zod)
    repo/                    workflows  ops (seq + E11000 retry)  runs
    presence/tracker.ts      Redis hash w/ TTL
    socket/gateway.ts        Socket.IO + Redis adapter
    rest/app.ts              REST API
    execution/
      engine.ts              topo run, branch routing, step persistence
      nodes/                 start  http  transform  branch  log
    bin/
      server.ts              http + ws entry
      runner.ts              run worker (consumes Job Queue)
      simulate.ts            end-to-end smoke test`,
};
