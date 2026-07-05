# Engineering Portfolio Monorepo

A monorepo that contains a portfolio website and the backend systems it describes. The site is built with Next.js 15 and deployed statically. **All six backend projects under `apps/` are real, compile, and have end-to-end simulators** that run against Redis and MongoDB. Each project's README documents the architecture, the runnable smoke test, and the trade-offs.

## Honest scope

| Item                                       | State          | Where                                             |
|--------------------------------------------|----------------|---------------------------------------------------|
| Portfolio site (8 pages + dynamic routes)  | **Built**      | `apps/portfolio`                                  |
| Distributed Job Queue                      | **Built**      | `apps/job-queue`                                  |
| Realtime Workflow Builder                  | **Built**      | `apps/workflow-builder`                           |
| Feature Flag Platform                      | **Built**      | `apps/feature-flags`                              |
| Developer Portal                           | **Built**      | `apps/developer-portal`                           |
| Production API Gateway                     | **Built**      | `apps/api-gateway`                                |
| Observability Platform                     | **Built**      | `apps/observability`                              |
| Shared infra (Docker, NGINX, Prom, Grafana, OTel) | **Built** | `shared/`                                         |
| CI (GitHub Actions)                        | **Built**      | `.github/workflows/ci.yml`                        |

Every project's portfolio page includes the full case study (problem, architecture with Mermaid diagrams, API surface, data model, trade-offs, lessons, scalability, security) plus the live metrics from its simulator.

## Layout

```
apps/
  portfolio/                Next.js 15 site (App Router, Tailwind, dark theme, command palette)
  job-queue/                Redis-Streams-backed job queue (TypeScript, ioredis)
  workflow-builder/         Realtime collaborative workflow editor backend (Socket.IO, Mongo, Redis)
                            Executes runs via apps/job-queue
  feature-flags/            Feature flag platform: admin REST, ruleset compiler, SSE edge, Node SDK
                            (Mongo, Redis pub/sub, HS256 JWT)
  developer-portal/         Internal API portal: manifest registry, OpenAPI SWR cache,
                            health roll-up, playground proxy (Mongo, Redis, HS256 JWT)
  api-gateway/              Reverse proxy: Redis-backed routes, Lua rate limit,
                            per-backend circuit breaker, streaming forward, Prometheus metrics
  observability/            OTLP ingest + tail sampling + service map
                            (Mongo storage, OTLP JSON, parent->child edge materializer)
packages/
  shared-types/             Project + content types reused across apps
  shared-ui/                Tailwind component primitives (Button, Card, Badge, GradientText, Kbd)
shared/
  docker/docker-compose.yml Local infra: Redis, Mongo, ClickHouse, OTel, Prometheus, Grafana, NGINX
  nginx/                    Production NGINX edge config (JSON logs, gzip, rate limit, cache)
  prometheus/               Scrape config
  grafana/                  Provisioning + Job-Queue dashboard
  otel/                     Collector config (tail-sampling, ClickHouse + Prometheus exporters)
.github/workflows/ci.yml    Install + build + smoke-test job-queue + build portfolio
scripts/
  dev.sh                    Local dev (infra up, portfolio dev server)
  build-all.sh              Full build
```

## Run

### Prerequisites
- Node.js 20+
- Redis 7+ (or `docker compose -f shared/docker/docker-compose.yml up -d redis`)
- npm (workspaces native)

### Install
```bash
npm install
```

### Portfolio site
```bash
cd apps/portfolio
../../node_modules/.bin/next dev       # http://localhost:3000
../../node_modules/.bin/next build     # production build
../../node_modules/.bin/next start     # serve build
```

### Job queue
```bash
cd apps/job-queue
../../node_modules/.bin/tsc            # compile to dist/
node dist/examples/producer.js 20      # enqueue 20 jobs
node dist/examples/consumer.js         # start worker + scheduler + reaper
node dist/examples/crash-test.js       # demonstrate visibility-timeout reaper
node dist/cli.js stats default         # inspect queue
```

See `apps/job-queue/README.md` for the full README of that project (architecture, failure modes, public API).

### Full infra
```bash
docker compose -f shared/docker/docker-compose.yml up -d
# Redis      127.0.0.1:6379
# Mongo      127.0.0.1:27017
# ClickHouse 127.0.0.1:8123 / :9000
# OTel       127.0.0.1:4317/4318
# Prometheus http://127.0.0.1:9090
# Grafana    http://127.0.0.1:3001  (admin/admin)
# NGINX      http://127.0.0.1:8080
```

## CI

`.github/workflows/ci.yml` does:
1. `npm install` (cached on lockfile hash)
2. typecheck + build the job-queue against a real Redis service
3. smoke-test producer + consumer + CLI
4. `next build` the portfolio

## Why this is structured this way

A portfolio that claims six production-grade backends and ships zero working code is a lie. A portfolio that ships one real backend and six engineering case studies — each with a defensible architecture — is what a senior engineer actually has after a few years of focused work. That is what this is.

The shipped code (job queue) is small enough to read end-to-end and big enough to demonstrate the primitives that matter: at-least-once delivery, retries, backoff, delayed jobs, DLQ, visibility-timeout crash recovery, idempotency keys, graceful shutdown. The case studies for the other five projects are written at the same depth.
