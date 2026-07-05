# @portfolio/api-gateway

A production-style API gateway: dynamic routes from Redis, per-consumer/per-route sliding-window rate limiting (Lua), per-backend circuit breaker, JWT consumer auth, streaming forward proxy, structured access logs, Prometheus metrics.

## What's real

| Concern | Implementation |
|---|---|
| Routing | Longest-prefix match on path + method filter; routes stored in Redis hash |
| Hot-reload | Redis pub/sub bumps trigger `loadAll()` in every gateway pod |
| Rate limit | Single Lua script: `ZREMRANGEBYSCORE` -> `ZCARD` -> `ZADD` -> `PEXPIRE`, atomic |
| Circuit breaker | In-process per-backend `closed` / `open` / `half_open`; opens on (failures/total >= errorRate) once `minRequests` reached |
| Auth | Optional per-route HS256 JWT; consumer becomes `claims.sub` and is propagated as `X-Consumer-Id` |
| Forward proxy | Node `http(s).request`, response **streamed** to client (no full buffering), 4MB request body cap |
| Idempotent retries | Per-route `maxRetries` (default 2) only on idempotent methods + configurable retry-on-status |
| Observability | Structured JSON access log per request, Prometheus text exposition at `/metrics` |
| Identity propagation | `X-Request-Id` (ULID), `X-Forwarded-By: api-gateway`, `X-Consumer-Id` added to upstream |

## Layout

```
apps/api-gateway/
  src/
    config.ts                 env config + redis keys + channel
    types.ts                  RouteCfg, BackendCfg, RateLimit, CircuitStats, AccessLog
    auth.ts                   HS256 JWT (consumer)
    redis.ts                  ioredis factory
    routes/
      registry.ts             HSET routes + PUBLISH bump; subscriber refreshes in-memory copy
      router.ts               longest-prefix + method filter
    middleware/
      rateLimit.ts            Lua sliding window (ZSET)
      circuit.ts              per-backend state machine
    metrics/counters.ts       counters + simple histograms -> Prometheus text
    proxy/
      forwarder.ts            streaming fetch upstream, header allow-list
      handler.ts              full request lifecycle (auth -> rl -> circuit -> forward -> retry -> log)
    control/rest.ts           control plane: routes CRUD + /circuit + /metrics
    bin/
      server.ts               proxy + control HTTP servers
      simulate.ts             end-to-end: route register, rate-limit burst, circuit trip + recover
  Dockerfile
  tsconfig.json
  package.json
```

## Run locally

Requires Redis (6379) up.

```bash
cd apps/api-gateway
../../node_modules/.bin/tsc
node dist/bin/server.js       # proxy :4700, control :4701
node dist/bin/simulate.js     # spawns 1 upstream, runs the full lifecycle
```

What the simulator proves:

1. POSTs a route `/api -> upstream`, with `rateLimit { windowMs: 1000, max: 5 }`.
2. Single GET returns 200 with `x-ratelimit-limit: 5`, `x-ratelimit-remaining: 4`, and a `x-request-id` ULID.
3. **Rate limit**: 12 concurrent GETs in <1s → `4x 200 + 8x 429`. The 4 successes match the remaining budget after the prior call.
4. **Circuit trip**: switches upstream to always-500; 5 failures cross the threshold (`minRequests=5`, `errorRate=0.5`) → `/circuit` shows `state: open` with `lastError: status_500`.
5. **Half-open + recovery**: sleeps past `circuitOpenMs` (5s), upstream restored, next probe returns 200, `/circuit` shows `state: closed`, counters reset.
6. `/metrics` returns Prometheus text including `gw_requests_total{route="echo-route",method="GET",status="200|429|500"}`, `gw_rate_limited_total`.

## Rate limit Lua (the important bit)

```lua
ZREMRANGEBYSCORE key 0 (now - windowMs)
local count = ZCARD key
if count >= max then
  -- compute Retry-After from the oldest entry
  return {1, count, max, retryAfterMs}
end
ZADD key now <member>
PEXPIRE key (windowMs * 2)
return {0, count + 1, max, 0}
```

Single round trip, no read-modify-write race between gateways. Member uses `now-<rand>` so concurrent adds at the same ms don't collide. TTL is doubled so an idle key gets cleaned up automatically.

## Circuit state machine

```
                successful probe
       ┌────────────────────────────────────┐
       │                                    ▼
[closed] ── failures/total >= errorRate ─▶ [open] ── openMs elapsed ─▶ [half_open] ── failed probe ─▶ [open]
   ▲                                                                              │
   └──────────────── successful probe ───────────────────────────────────────────┘
```

Per backend URL. Half-open allows exactly one probe at a time. A success closes the breaker and resets the rolling counter; a failure re-opens it.

## Control plane

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | liveness |
| GET | `/routes` | list of in-memory routes |
| POST | `/routes` | upsert (validated by zod schema), publishes refresh |
| DELETE | `/routes/:id` | removes + publishes refresh |
| GET | `/circuit` | current breaker state per backend URL |
| GET | `/metrics` | Prometheus text |

## Decisions worth defending

- **Streaming responses, not buffer-then-write.** A large download stays bounded in memory regardless of file size; the gateway only buffers requests up to 4MB.
- **Routes in Redis hash, broadcast over pub/sub.** Multiple gateway pods stay consistent without a leader; if Redis is unavailable, the in-memory copy is still authoritative until a deploy.
- **Lua for rate limiting.** Eliminates the "two pods read 4, both write 5, both accept" race. Single round trip.
- **In-process circuit state.** Honest about the boundary: Redis-replicated circuit state is desirable for global outage handling but adds 1 RTT per request. This trade is documented; a future evolution is a Redis-coordinated breaker.
- **Idempotent retries only.** Retrying a POST on 503 risks duplicate side effects. Default retry set is `GET/HEAD/OPTIONS/PUT/DELETE` only (configurable per route).
- **Header allow-list.** Hop-by-hop headers stripped both directions; `X-Request-Id`, `X-Forwarded-By`, `X-Consumer-Id` always present upstream.
