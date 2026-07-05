# Workflow Builder

Real-time multi-user backend for a visual workflow editor. Built on Express + Socket.IO + MongoDB + Redis, with execution running through the **Job Queue** project from this monorepo.

## What it does

- **Multi-user editing**: clients connect over Socket.IO, join a workflow room, submit ops. Server assigns monotonic `seq` per workflow and fans the op out to every other connected client in the room via the Redis Pub/Sub adapter. Works across horizontally-scaled gateway pods.
- **Presence**: cursors and selections propagate cross-socket. Stale presence expires from a Redis hash after 45s.
- **Snapshotting**: every N ops the server materializes the document and persists it on the workflow record, so reconnecting clients don't replay the entire op log.
- **Execution engine**: triggers create a `Run` and enqueue into the shared Job Queue. A worker process pops jobs, hydrates the workflow, and executes it: start → node → next-edge picked by branch label. Each step's input, output, logs, and timing are persisted.
- **Built-in nodes**: `start`, `http` (real fetch with timeout), `transform` (JS expr in vm sandbox), `branch` (condition in vm sandbox, picks `true`/`false` edge), `log` (template-rendered message).
- **JWT auth**: HS256 on REST and on the Socket.IO handshake.

## Architecture

```
Browsers ─┐
          ├── Socket.IO ── Express ── Mongo (workflows, ops, runs)
          │       │
          │       └── Redis Pub/Sub ── other gateway pods
          │
          └── REST (POST /api/workflows/:id/runs)
                          │
                          ▼
                 Job Queue (Redis Streams) ── Runner worker ── Execution engine
                                                                 │
                                                                 ▼
                                                          step results → Mongo
```

The realtime tier (gateway + Pub/Sub + Mongo for ops) and the execution tier (queue + worker + Mongo for runs) are decoupled. Either can be scaled or restarted independently.

## File layout

```
src/
  config.ts                 env config
  types.ts                  Node, Edge, Op, Workflow, Run
  mongo.ts                  Mongo client + indexes
  redis.ts                  ioredis factory
  auth.ts                   HS256 JWT sign/verify
  ops/
    apply.ts                pure op-applier + materializer
    validate.ts             zod schemas for ops
  repo/
    workflows.ts            create, get, list, rename, remove, hydrate, snapshot
    ops.ts                  nextSeq, append (E11000-retry), since
    runs.ts                 create, setStatus, pushStep, patchStep
  presence/tracker.ts       per-room presence in a Redis hash
  socket/gateway.ts         Socket.IO + Redis adapter + auth + room mgmt + op fan-out
  rest/app.ts               Express app: dev-token, workflows CRUD, runs trigger/list/get
  execution/
    engine.ts               topological run, edge selection by branch label, step persistence
    nodes/{start,http,transform,branch,log}.ts
  bin/
    server.ts               http+ws server entry
    runner.ts               execution worker entry (consumes from Job Queue)
    simulate.ts             multi-client + execution end-to-end smoke test
Dockerfile
tsconfig.json
package.json
```

## Run

Prereqs: Node 20+, MongoDB on `127.0.0.1:27017`, Redis on `127.0.0.1:6379`.

```bash
cd apps/workflow-builder
../../node_modules/.bin/tsc

# Terminal 1: gateway + REST API
node dist/bin/server.js
# [workflow-builder] http+ws listening on :4400

# Terminal 2: execution worker
node dist/bin/runner.js
# [runner] consuming queue 'workflow-runs' as <hostname>-<pid>-<ts>

# Terminal 3: multi-client + end-to-end test
node dist/bin/simulate.js
# ✔ simulator pass
#   - 2 clients, op fan-out via Redis adapter ✓
#   - presence propagated cross-socket ✓
#   - end-to-end run completed: status=succeeded
```

## API

### REST (Bearer JWT, except `/auth/*` and `/health`)

| Method | Path                                  | Description                                   |
|--------|---------------------------------------|-----------------------------------------------|
| GET    | `/health`                             | Liveness                                       |
| POST   | `/auth/dev-token`                     | Issue a JWT (dev only): `{ sub, name? }`       |
| GET    | `/api/workflows`                      | List workflows owned by the caller             |
| POST   | `/api/workflows`                      | Create workflow `{ name }`                     |
| GET    | `/api/workflows/:id`                  | Workflow + materialized doc + current seq      |
| PATCH  | `/api/workflows/:id`                  | Rename                                         |
| DELETE | `/api/workflows/:id`                  | Delete + drop op log                           |
| POST   | `/api/workflows/:id/runs`             | Trigger a run; enqueues to Job Queue           |
| GET    | `/api/workflows/:id/runs`             | List runs for a workflow                       |
| GET    | `/api/runs/:id`                       | Run status + steps + outputs                   |

### Socket.IO (handshake: `{ auth: { token } }`)

| Event                  | Direction | Payload                                                            |
|------------------------|-----------|--------------------------------------------------------------------|
| `workflow:join`        | C→S       | `workflowId` (string), ack returns `{ workflow, presence }`        |
| `op:submit`            | C→S       | `{ workflowId, op }`, ack returns `{ ok, seq }` or error           |
| `op:catchup`           | C→S       | `{ workflowId, sinceSeq }`, ack returns batched ops                |
| `presence:update`      | C→S       | `{ workflowId, cursor?, selection? }`                              |
| `op:apply`             | S→C       | Broadcast of every appended op (envelope: `{ workflowId, seq, op, ts }`) |
| `presence:update`      | S→C       | Broadcast of another actor's cursor                                |
| `presence:join` / `leave` | S→C    | Room membership changes                                            |

## Data model (MongoDB)

| Collection       | Index                                      | Notes                                              |
|------------------|--------------------------------------------|----------------------------------------------------|
| `workflows`      | `{ ownerId: 1, updatedAt: -1 }`            | Latest snapshot + `snapshotSeq` for log truncation |
| `workflow_ops`   | `{ workflowId: 1, seq: 1 }` unique         | Append-only, monotonic per workflow                |
| `workflow_runs`  | `{ workflowId: 1, startedAt: -1 }`         | Steps embedded for atomic update                   |

## Tradeoffs

- **Server-assigned seq, optimistic apply on the client** — simpler than a CRDT; correct for the small-op canvas use case. A CRDT (Yjs) would enable offline-first editing at the cost of a much larger surface area and harder server-side validation.
- **Redis Pub/Sub adapter, not Redis Streams** — fan-out is fire-and-forget across gateway pods; durability lives in Mongo (op log). Streams would give replay on the wire too, but you don't need that when clients can `op:catchup` from Mongo.
- **One `Run` doc per execution, steps embedded** — fast read for the UI; bounded by step count (cap at 200). For very long-running workflows you'd promote `steps` to its own collection.
- **vm sandbox for transform / branch, not eval** — `node:vm` with `codeGeneration: { strings: false, wasm: false }` and a 200ms-1s timeout. Real isolation needs `vm2` (deprecated) or `isolated-vm`; ship that before exposing to untrusted code.

## Failure modes

| Failure                              | What happens                                                    |
|--------------------------------------|-----------------------------------------------------------------|
| Two clients append at the same seq   | Mongo unique-index on `(workflowId, seq)` rejects; `OpRepo.append` retries up to 5×. |
| Gateway pod crashes mid-op           | Op either committed to Mongo and broadcast, or neither. Client retries on reconnect. |
| Runner crashes mid-execution         | Job Queue's visibility-timeout reaper redelivers; partial steps are visible in `Run.steps`. The execution is re-run from the beginning. |
| Handler in a node node hangs         | `http` has an `AbortController` timeout; `transform`/`branch` have vm script timeouts. |
| Workflow deleted while a run is queued | Runner sets run to `failed` with `error: "workflow deleted"`. |

## Verified end-to-end (this checkout, against local Redis + Mongo)

```
▸ creating workflow
  created 01KVZ5S98VHNYDXPC9V7F5Z6MY
▸ two clients connect and join the room
  both joined
▸ alice submits ops to build a branching workflow
  bob saw op seq=1..9 (fan-out via Redis adapter)
▸ bob updates presence; alice receives it
▸ trigger an execution run
  enqueued run 01KVZ5SA0F7VMQ9DKZFRK0DRFC
  run 01KVZ5SA0F7VMQ9DKZFRK0DRFC → succeeded (4 steps)
✔ simulator pass
```

The 4 steps executed: `start` → `http` (real `GET https://example.com` → 200) → `branch` (condition `vars['<httpId>'].status === 200` → took `true` edge) → `log` (rendered template).
