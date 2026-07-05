# Distributed Job Queue

Redis-backed job queue in TypeScript. At-least-once delivery, retries with backoff, delayed jobs, dead-letter queue, crash-recovery via visibility timeout, idempotency keys, graceful shutdown.

Built on Redis **Streams** (`XADD` / `XREADGROUP` / `XACK` / `XCLAIM`), not lists. Streams give you consumer groups and per-message ack semantics out of the box; lists do not.

## Architecture

```
                 ┌──────────────┐
   Producer ───► │ XADD stream  │ ───► Workers (XREADGROUP)
                 └──────┬───────┘            │
                        │                    │ success ──► XACK + XDEL  + state=completed
                        │                    │ fail+retry ► ZADD delayed (run_at)
                        │                    │ fail+done ► XADD dlq    + state=dead
                        │                    │
                        │            (handler crash / no ack)
                        │                    │
                        │            ┌───────▼────────┐
                        │            │ Reaper         │
                        │            │ XPENDING IDLE  │
                        │            │ XCLAIM ─► retry/dead
                        │            └────────────────┘
                        │
                ┌───────▼──────────┐
                │ Scheduler        │
                │ ZRANGEBYSCORE    │
                │ Lua atomic move  │
                │ delayed → stream │
                └──────────────────┘
```

## Redis keys

| Key                       | Type   | Purpose                                  |
|---------------------------|--------|------------------------------------------|
| `jq:stream:<queue>`       | stream | main work stream                         |
| `jq:dlq:<queue>`          | stream | dead-letter audit log                    |
| `jq:delayed:<queue>`      | zset   | scheduled/retry jobs, score = run-at ms  |
| `jq:job:<id>`             | hash   | job metadata + encoded payload           |
| `jq:idem:<queue>:<key>`   | string | idempotency reservation, NX EX           |

## Run

Requires Redis 7+ on `127.0.0.1:6379` (override with `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`).

```bash
./node_modules/.bin/tsc
redis-cli FLUSHDB

node dist/examples/producer.js 20        # enqueue 20 jobs (some delayed, some idempotent)
node dist/examples/consumer.js            # start worker + scheduler + reaper
node dist/examples/crash-test.js          # demonstrates visibility-timeout redelivery
```

CLI inspector:

```bash
node dist/cli.js stats default
node dist/cli.js peek default 10
node dist/cli.js dlq:list default 20
node dist/cli.js dlq:requeue default <jobId>
node dist/cli.js dlq:purge default
node dist/cli.js job <jobId>
```

## Public API

```ts
import {
  createRedis, Queue, Worker, Scheduler, Reaper,
  DeadLetterQueue, installGracefulShutdown,
} from "./dist/index.js";

const redis = createRedis();
const queue = new Queue(redis, { name: "emails", defaultMaxAttempts: 5 });
await queue.add("send", { to: "x@y.z" }, { delayMs: 1000, idempotencyKey: "x@y.z" });

const worker = new Worker(redis, { queue: "emails", concurrency: 8 },
  async (job, signal) => { /* handle, respect AbortSignal */ });
await worker.start();

new Scheduler(redis, { queue: "emails" }).start();   // moves delayed → stream
new Reaper(redis, { queue: "emails", visibilityTimeoutMs: 30_000 }).start();

installGracefulShutdown({ workers: [worker], redis: [redis] });
```

## Failure modes

| Failure                          | What happens                                                                                  |
|----------------------------------|-----------------------------------------------------------------------------------------------|
| Handler throws                   | Worker decides: retry with backoff (state=delayed) or move to DLQ if attempts exhausted       |
| Handler times out                | `AbortController` fires after `timeoutMs`; treated as handler throw                            |
| Worker process crashes mid-job   | Job stays in PEL; reaper finds it via `XPENDING IDLE` > `visibilityTimeoutMs` and `XCLAIM`s it |
| Worker hangs but does not crash  | Same — reaper claims based on idle time, not liveness                                          |
| Redis crashes mid-add            | Producer fails; client retries via ioredis reconnect; pipeline is `MULTI`, all-or-nothing     |
| Two schedulers race              | Lua script makes ZREM + XADD atomic; at-most-once promotion of a delayed job                  |
| Duplicate enqueue                | `idempotencyKey` + `SET NX EX`: returns the original job                                      |
| SIGTERM during processing        | Lifecycle stops fetch loop, drains in-flight up to `drainTimeoutMs`; unacked jobs reaped       |
| Poison message (bad JSON)        | Acked + deleted; `metrics.poison` incremented; never retried                                  |

## Delivery semantics

**At-least-once.** Handlers must be idempotent. Combine with `idempotencyKey` on the producer for end-to-end dedup.

Exactly-once is impossible in distributed systems without a 2PC the consumer can participate in — Redis does not give you that, so we don't claim it.

## File layout

```
src/
  redis.ts          ioredis factory, healthcheck
  types.ts          public types
  keys.ts           Redis key naming
  ulid-id.ts        sortable job IDs
  serializer.ts     JSON envelope w/ schema version
  semaphore.ts      counting semaphore for worker concurrency
  retry.ts          fixed / exponential / exponential-jitter backoff
  idempotency.ts    SET NX EX reservation
  lua.ts            atomic move + ack-and-(complete|retry|dead) scripts
  queue.ts          producer (Queue.add, addBulk, counts, get)
  worker.ts         consume loop, ack, retry/DLQ routing, AbortController timeout
  scheduler.ts      delayed → stream promotion (Lua)
  reaper.ts         XPENDING + XCLAIM, recovers stalled jobs
  dlq.ts            list / requeue / purge dead jobs
  events.ts         EventEmitter wrapper
  metrics.ts        counters + latency percentiles
  lifecycle.ts      graceful shutdown
  cli.ts            ops inspector
  index.ts          public exports
  examples/
    producer.ts
    consumer.ts
    crash-test.ts   demo of visibility-timeout redelivery
```

## What this is not

- Not BullMQ. BullMQ has flows, rate limiters, repeatable jobs, a UI, and years of production hardening. This is a focused implementation of the core primitives so the mechanics are visible end-to-end.
- Not RabbitMQ. No exchanges, no routing, no AMQP.
- Not Kafka. No long-term log retention, no partitioning model.

## Things worth pointing out in interviews

- **Streams over lists**: explicit ack via `XACK`, redelivery via `XCLAIM`, time-ordered IDs.
- **Visibility timeout via `XPENDING IDLE`**: same pattern as SQS, implemented in ~50 lines of reaper.
- **Atomic delayed promotion in Lua**: prevents double-enqueue when running multiple scheduler instances.
- **Semaphore-gated prefetch**: workers fetch only what they have capacity for, not blind `COUNT n`.
- **AbortController + Promise.race**: handler timeout that the handler itself can observe.
- **Idempotency keys**: producer-side dedup so retries on the publisher side don't fan out into duplicate work.
- **Graceful shutdown**: stop fetching → drain in-flight → close Redis. Any leaks get cleaned up by the reaper.
