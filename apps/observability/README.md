# @portfolio/observability

OTLP-ingest observability platform: receives OpenTelemetry traces + logs over HTTP/JSON, runs tail-based sampling, persists kept traces to MongoDB, and materializes a service map.

## What's real

| Concern | Implementation |
|---|---|
| Receiver | `POST /v1/traces`, `POST /v1/logs` accepting OTLP JSON (the protobuf-shaped JSON the OTel SDKs emit) |
| Span parsing | `resourceSpans → scopeSpans → spans`, with `service.name` resolution and ns→ms time conversion |
| Trace assembly | In-process bucket per `traceId`, drained when idle for `bufferHoldMs` |
| Tail sampling | Per-trace decision: keep on error, keep on slow (`durationMs >= slowTraceMs`), else probabilistic at `sampleRate` |
| Storage | MongoDB `spans`, `traces`, `logs`, `services`, `service_edges` |
| Service map | Materialized from kept traces: nodes get rolling-avg latency, edges aggregate parent→child cross-service calls |
| Query API | Trace search, full trace tree (parent/child map), service map, logs joined by traceId, ingest stats |

## Layout

```
apps/observability/
  src/
    config.ts                 env config (port, sampleRate, slowTraceMs, bufferHoldMs)
    types.ts                  Span, Log, Trace, ServiceNode, ServiceEdge, IngestStats
    mongo.ts                  collections + indexes
    otlp/parse.ts             OTLP JSON -> SpanDoc[] / LogDoc[]
    ingest/buffer.ts          in-memory trace assembly (drainIdle / drainAll)
    sampling/
      tail.ts                 pure decision function (error / slow / probabilistic)
      worker.ts               interval flusher: drainIdle -> decide -> store -> materialize
    storage/
      spans.ts                writeTrace, searchTraces, getTrace
      services.ts             rolling-avg service nodes + parent->child edges
    rest/app.ts               receivers + query API + /stats
    bin/
      server.ts               single HTTP process
      generator.ts            synthetic frontend->api->db trace producer
  Dockerfile
  tsconfig.json
  package.json
```

## Run locally

Requires MongoDB (27017) up.

```bash
cd apps/observability
../../node_modules/.bin/tsc
node dist/bin/server.js          # on :4800
node dist/bin/generator.js       # emits 12 traces: 1 error, 1 slow, 10 fast OK
```

What the generator proves:

1. Emits 12 traces (each = 3 spans across `frontend → api → db`).
2. Sleeps until `tracesBuffered === 0` and `tracesFlushed + tracesDropped >= 12`.
3. Asserts the tail sampler decisions are correct:

   ```json
   {
     "spansReceived": 36,
     "logsReceived": 1,
     "tracesFlushed": 3,
     "tracesDropped": 9,
     "byReason": { "error": 1, "slow": 1, "probabilistic": 1, "dropped": 9 }
   }
   ```

4. `GET /traces?hasErrors=true` returns the error trace (`sampledReason: "error"`).
5. `GET /traces?minDurationMs=500` returns the slow trace (`durationMs: 850, sampledReason: "slow"`).
6. `GET /trace/:id` returns the full trace tree (3 spans, db span shows `status: "error"`).
7. `GET /logs?traceId=...` returns the deadlock log linked to the trace.
8. `GET /servicemap` returns 3 nodes and 2 edges with real rolling averages (`frontend->api: ~255ms`, `api->db: ~204ms`).

## Tail-sampling decision (pure, testable)

```ts
function decide(spans: SpanDoc[], policy): SamplingDecision {
  if (spans.some(s => s.status === "error")) return { keep: true, reason: "error" };
  const dur = max(end) - min(start);
  if (dur >= policy.slowTraceMs)              return { keep: true, reason: "slow" };
  if (Math.random() < policy.sampleRate)      return { keep: true, reason: "probabilistic" };
  return { keep: false, reason: "dropped" };
}
```

The reason ships with each kept trace. You can query `/traces?service=api` and immediately see why each trace survived.

## Rolling averages in Mongo (the careful bit)

Per-service `avgDurationMs` and per-edge `avgLatencyMs` are updated with a Mongo aggregation pipeline so we don't read-modify-write from the app:

```js
await services.updateOne({ name }, {
  $setOnInsert: { _id: ulid(), firstSeen },
  $set: { lastSeen },
  $inc: { traceCount: 1, errorCount, avgDurationMs: 0 },
}, { upsert: true });

await services.updateOne({ name }, [{
  $set: {
    avgDurationMs: {
      $divide: [
        { $add: [
            { $multiply: [{ $ifNull: ["$avgDurationMs", 0] }, { $subtract: ["$traceCount", 1] }] },
            traceAvg
        ]},
        "$traceCount"
      ]
    }
  }
}]);
```

`$ifNull` is load-bearing: any aggregation op on a missing field returns `null`, which would silently produce `avgLatencyMs: 0` on every refresh. (Verified in this codebase — caught and fixed.)

## Query API

| Method | Path | Notes |
|---|---|---|
| POST | `/v1/traces` | OTLP JSON traces |
| POST | `/v1/logs` | OTLP JSON logs (persisted to `logs`, joined by `traceId` later) |
| GET | `/traces?service=&hasErrors=&minDurationMs=&since=&limit=` | trace search |
| GET | `/trace/:traceId` | full trace: `{trace, spans, childrenByParent}` |
| GET | `/services` | service nodes |
| GET | `/servicemap` | `{nodes, edges}` with rolling averages |
| GET | `/logs?traceId=&since=&limit=` | log search, often joined by traceId |
| GET | `/stats` | live ingest counters |
| GET | `/health` | liveness |

## Decisions worth defending

- **Tail sampling, not head sampling.** Head-sampling drops 90% of traces blindly; tail keeps everything you actually need (errors, slow paths) plus a representative sample. Real cost reduction without losing the debugging story.
- **In-process buffer over Redis-backed buffer.** Honest trade: faster, simpler, but doesn't survive a restart and doesn't aggregate across gateway pods. The TraceBuffer interface isolates this so a Redis implementation is a drop-in.
- **OTLP JSON, not protobuf.** Same wire format the OTel SDKs emit when `OTEL_EXPORTER_OTLP_PROTOCOL=http/json` — keeps the demo dependency-free while staying spec-correct.
- **Service map derived from kept traces.** Avoids a separate path; if it isn't kept by the tail, it doesn't shape the map. This is correct for the "we care about real symptoms" usage but worth documenting.
- **Rolling averages via aggregation pipeline.** Avoids the read-modify-write race; safe under concurrent ingest.
- **Tagged sample reason per trace.** Operators can answer "why did we keep this?" without re-running the policy.
