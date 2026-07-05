# @portfolio/feature-flags

A production-style feature flag platform: targeting rules, sticky percentage rollouts, environment-scoped rulesets, real-time SDK propagation via SSE, audit log.

## What's real

| Concern | Implementation |
|---|---|
| Storage | MongoDB (`flags`, `audit`, `meta`) |
| Versioned ruleset | Per-env monotonic version in `meta` |
| Compile | Flag def -> compact ruleset (rules, rollouts, variants per flag) |
| Eval | Order: disabled → rule match → rollout (sticky bucket) → default |
| Bucketing | FNV1a 32-bit, `bucket(userId, flagKey) % 10000`, percentage * 100 cutoff |
| Distribution | Redis pub/sub (`ff:ruleset:version`) + cached payload `ff:ruleset:<env>:<v>` |
| Edge | SSE endpoint `/sse/:env`, immediate snapshot on connect + push on bump |
| SDK | In-memory eval, refetches on SSE event, automatic SSE reconnect with backoff |
| Auth | HS256 JWT, roles `admin` / `editor` / `sdk` |
| Audit | Every create/update/delete records actor + diff |

## Layout

```
apps/feature-flags/
  src/
    config.ts            env config + redis key helpers
    types.ts             Flag, Condition, Rule, CompiledFlag, Ruleset
    auth.ts              HS256 JWT sign/verify
    mongo.ts             flags, audit, meta + indexes
    redis.ts             ioredis factory
    compiler/
      bucket.ts          FNV1a + inRollout
      compile.ts         flag list + env + version -> Ruleset
      eval.ts            CompiledFlag + ctx -> EvalResult; RulesetIndex
    repo/
      flags.ts           CRUD + per-env merge updates
      audit.ts           immutable append, indexed by flagKey+ts
      meta.ts            per-env version counter (findOneAndUpdate $inc)
    bus/publisher.ts     SET versioned payload + SET latest + PUBLISH
    sse/edge.ts          /sse/:env, /ruleset/:env/latest, /ruleset/:env/:v
    rest/app.ts          /flags CRUD, /eval, /audit, /admin/rebuild
    sdk/node.ts          FeatureFlagClient (fetch + SSE + auto-refresh)
    bin/
      server.ts          REST + SSE process
      simulate.ts        create -> eval -> patch -> SDK observes flip
  Dockerfile
  tsconfig.json
  package.json
```

## Run locally

Requires Mongo (27017) and Redis (6379) up.

```bash
cd apps/feature-flags
../../node_modules/.bin/tsc
node dist/bin/server.js          # admin REST + SSE edge on :4500
node dist/bin/simulate.js        # end-to-end smoke test
```

The simulator:
1. Mints an admin JWT.
2. Creates a flag with one rule (`attrs.role == "beta"`) and a 50% rollout.
3. Boots an SDK pointing at the same env, waits for ready.
4. Asserts a beta user matches the rule.
5. Runs 200 user buckets, prints the rollout distribution (typically ~50/50).
6. PATCHes the env to `enabled: false`.
7. Asserts the SDK observed the version bump over SSE within ~500ms.
8. Asserts the new eval returns `reason: "disabled"`.

Sample output:

```
sdk: ruleset version 3
=== eval beta user === { variant: "on", value: true, reason: "rule_match" }
=== rollout distribution (200 users) === { default: 103, rollout: 97 }
sdk: ruleset version 4
=== eval after flip === { variant: "off", value: false, reason: "disabled" }
```

## SDK usage

```ts
import { FeatureFlagClient } from "@portfolio/feature-flags";

const sdk = new FeatureFlagClient({
  baseUrl: "http://flags.internal:4500",
  env: "prod",
  authToken: process.env.FF_TOKEN,
});
await sdk.start();
await sdk.ready();

if (sdk.boolean("new_checkout", { userId: req.user.id, attrs: { plan: req.user.plan } })) {
  // ...
}
```

Evaluation is local in the calling process. No request to the edge per eval. SSE pushes a version event; the SDK only refetches when the version moves forward.

## REST API (short)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/dev-token` | dev-only convenience; returns HS256 JWT |
| GET | `/flags` | list all flags |
| GET | `/flags/:key` | single flag |
| POST | `/flags` | create; triggers rebuild for all envs the flag is in |
| PATCH | `/flags/:key/env/:env` | partial env config update + audit + rebuild |
| DELETE | `/flags/:key` | delete + audit + rebuild |
| POST | `/eval` | server-side eval against latest ruleset |
| POST | `/admin/rebuild` | force rebuild a specific env |
| GET | `/audit` | recent entries, optional `?flag=key` |
| GET | `/ruleset/:env/latest` | full compiled ruleset JSON |
| GET | `/sse/:env` | text/event-stream, `ruleset` event with `{env, version}` |

## Decisions worth defending

- **Local-eval SDK, not edge-eval.** Eliminates per-request RTT; edge stays simple (push events + cache reads).
- **Version-bump-only push, payload pulled.** Keeps SSE messages tiny so a noisy environment doesn't flood every connected client with full rulesets.
- **`findOneAndUpdate $inc` for version counter.** Single atomic op; no race between two editors flipping the same flag.
- **FNV1a + `% 10000`.** Pure (no PRNG state), sticky per (userId, flagKey), 0.01% bucket resolution — enough for 50/25/12.5%-style rollouts.
- **Default-deny rules.** A rule with no matching condition silently falls through to the next rule, then rollout, then default — never crashes.
