# @portfolio/developer-portal

Backstage-style internal developer portal: a registry of services with owners, tiers, lifecycle state, OpenAPI surface, a health roll-up, and a playground proxy for poking endpoints from one UI.

## What's real

| Concern | Implementation |
|---|---|
| Service registry | Mongo `services`, manifest-driven, unique on `id` |
| Manifest validation | zod schema in `src/catalog/validator.ts` |
| Version history | Every change writes `service_versions` (immutable) |
| OpenAPI fetch | SWR-style cache in Redis (`devportal:openapi:<id>`, TTL configurable) |
| Health roll-up | Concurrent `fetch` against each service's `healthUrl`, status + latency |
| Playground proxy | Server-side fetch with header allow-list and timeout |
| Auth | HS256 JWT, `admin` / `editor` / `viewer` roles |

## Layout

```
apps/developer-portal/
  src/
    config.ts                env config + cache keys
    types.ts                 ServiceManifest, Service, HealthResult, PlaygroundRequest/Response
    auth.ts                  HS256 JWT
    mongo.ts                 services + versions + indexes
    redis.ts                 ioredis factory
    catalog/validator.ts     zod schema for manifests
    repo/services.ts         upsert (with version bump if changed), search, history, remove
    openapi/fetch.ts         Redis-cached OpenAPI fetcher
    health/checker.ts        concurrent health checks with timeout
    playground/proxy.ts      header-sanitizing fetch proxy
    rest/app.ts              REST endpoints
    bin/
      server.ts              REST entry
      simulate.ts            end-to-end smoke test with 2 in-process upstreams
  Dockerfile
  tsconfig.json
  package.json
```

## Run locally

Requires Mongo (27017) and Redis (6379) up.

```bash
cd apps/developer-portal
../../node_modules/.bin/tsc
node dist/bin/server.js        # on :4600
node dist/bin/simulate.js      # spins up 2 in-proc upstreams and exercises everything
```

What the simulator proves:

1. Boots two upstream HTTP services (each exposes `/health`, `/openapi.json`, `/echo`).
2. POSTs two manifests; second POST changes billing → version bumps from `1` to `2`, history kept.
3. `GET /services?q=ser` returns both with correct version numbers.
4. `GET /services/billing-service/openapi` first returns `source: "origin"`, second returns `source: "cache"` (validated against Redis).
5. `GET /health-rollup` returns `{ up: 2 }` with measured latency.
6. `POST /services/billing-service/playground` with `x-trace-id` header and JSON body returns the upstream's echo verbatim, including the `x-forwarded-by: developer-portal` header that the proxy injected.

Sample tail:

```json
"playground call": {
  "status": 200,
  "durationMs": 20.01,
  "body": {
    "hello": "from-svc-a",
    "method": "POST",
    "receivedBody": { "ping": true, "n": 42 },
    "upstreamHeaders": {
      "x-forwarded-by": "developer-portal",
      "x-trace-id": "trace-abc-123"
    }
  }
}
```

## REST API

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/dev-token` | dev convenience, returns HS256 JWT |
| GET | `/services?q=&tier=&lifecycle=&team=&tag=&limit=` | search + filter |
| GET | `/services/:id` | single service |
| GET | `/services/:id/versions` | manifest history (newest first, capped 50) |
| POST | `/manifests` | upsert; only bumps version if manifest actually changed |
| DELETE | `/services/:id` | removes service + history + invalidates openapi cache |
| GET | `/services/:id/openapi` | cached OpenAPI doc (with `source: cache | origin`) |
| POST | `/services/:id/openapi/refresh` | bust cache and refetch |
| GET | `/health-rollup` | parallel `/health` ping against everything in the catalog |
| POST | `/services/:id/playground` | proxy `{method, path, query, headers, body}` to `baseUrl` |

## Decisions worth defending

- **Upsert is "diff-aware".** Posting the same manifest twice does *not* bump the version. A version represents a real change to the contract.
- **OpenAPI cache is read-through + invalidated on manifest bump.** Avoids stale docs after an API change, while keeping the steady-state path cheap.
- **Header allow-list on the playground.** Hop-by-hop headers (`connection`, `transfer-encoding`, `upgrade`, ...) and `cookie` / `set-cookie` are dropped; user can still pass arbitrary debug headers like `x-trace-id`. `x-forwarded-by: developer-portal` is always added so upstream logs make the source obvious.
- **Health rollup is a single fan-out, not per-service polling.** The portal does not own health state; it provides an on-demand snapshot. Real per-service availability lives in your monitoring stack.
- **Tier + lifecycle as first-class fields.** Search by `tier=tier-0&lifecycle=ga` is the question "what runs in prod that an incident commander needs to know about right now".
