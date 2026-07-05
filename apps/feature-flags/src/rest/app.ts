import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { signToken, verifyToken, type AuthClaims } from "../auth.js";
import { compileRuleset } from "../compiler/compile.js";
import { RulesetIndex } from "../compiler/eval.js";
import type { RulesetPublisher } from "../bus/publisher.js";
import type { AuditRepo } from "../repo/audit.js";
import type { FlagsRepo } from "../repo/flags.js";
import type { MetaRepo } from "../repo/meta.js";
import type { Flag, FlagType } from "../types.js";

export interface AppDeps {
  flags: FlagsRepo;
  audit: AuditRepo;
  meta: MetaRepo;
  publisher: RulesetPublisher;
  jwtSecret: string;
  defaultEnvs?: string[];
}

const variantSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.boolean(), z.string(), z.number()]),
});

const conditionSchema = z.object({
  attr: z.string().min(1),
  op: z.enum([
    "eq",
    "neq",
    "in",
    "notIn",
    "contains",
    "startsWith",
    "endsWith",
    "gt",
    "gte",
    "lt",
    "lte",
    "regex",
  ]),
  value: z.unknown(),
});

const ruleSchema = z.object({
  id: z.string().min(1).optional(),
  description: z.string().optional(),
  conditions: z.array(conditionSchema).min(1),
  variant: z.string().min(1),
});

const envConfigSchema = z.object({
  enabled: z.boolean().optional(),
  defaultVariant: z.string().min(1).optional(),
  rules: z.array(ruleSchema).optional(),
  rollout: z
    .object({
      variant: z.string().min(1),
      percentage: z.number().min(0).max(100),
    })
    .optional(),
});

const createFlagSchema = z.object({
  key: z.string().regex(/^[a-z0-9._-]+$/i),
  type: z.enum(["boolean", "string", "number"]) satisfies z.ZodType<FlagType>,
  description: z.string().optional(),
  variants: z.array(variantSchema).min(2),
  environments: z
    .record(
      z.object({
        enabled: z.boolean(),
        defaultVariant: z.string(),
        rules: z.array(ruleSchema).default([]),
        rollout: z
          .object({
            variant: z.string(),
            percentage: z.number().min(0).max(100),
          })
          .optional(),
      }),
    )
    .default({}),
  owner: z.string().default("anonymous"),
});

const evalSchema = z.object({
  flag: z.string().min(1),
  env: z.string().min(1),
  context: z.object({
    userId: z.string().optional(),
    attrs: z.record(z.unknown()).optional(),
  }),
});

export function buildApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/auth/dev-token", (req, res) => {
    const { sub, role, envs } = req.body ?? {};
    const claims: AuthClaims = {
      sub: typeof sub === "string" ? sub : "dev",
      role: role === "sdk" || role === "editor" ? role : "admin",
      envs: Array.isArray(envs) ? envs : deps.defaultEnvs,
    };
    res.json({ token: signToken(claims, deps.jwtSecret), claims });
  });

  function auth(role?: AuthClaims["role"]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const header = req.headers.authorization;
      if (!header?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "missing_token" });
      }
      try {
        const claims = verifyToken(header.slice(7), deps.jwtSecret);
        if (role && claims.role !== role && claims.role !== "admin") {
          return res.status(403).json({ error: "insufficient_role" });
        }
        (req as Request & { user: AuthClaims }).user = claims;
        next();
      } catch {
        res.status(401).json({ error: "invalid_token" });
      }
    };
  }

  async function rebuildAndPublish(envs: string[]): Promise<
    Array<{ env: string; version: number; flags: number }>
  > {
    const flags = await deps.flags.list();
    const out: Array<{ env: string; version: number; flags: number }> = [];
    for (const env of envs) {
      const version = await deps.meta.nextVersion(env);
      const ruleset = compileRuleset(flags, env, version);
      await deps.publisher.publish(ruleset);
      out.push({ env, version, flags: ruleset.flags.length });
    }
    return out;
  }

  app.get("/flags", auth(), async (_req, res) => {
    res.json(await deps.flags.list());
  });

  app.get("/flags/:key", auth(), async (req, res) => {
    const key = String(req.params.key);
    const flag = await deps.flags.getByKey(key);
    if (!flag) return res.status(404).json({ error: "not_found" });
    res.json(flag);
  });

  app.post("/flags", auth("editor"), async (req, res) => {
    const parsed = createFlagSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation", details: parsed.error.flatten() });
    }
    const existing = await deps.flags.getByKey(parsed.data.key);
    if (existing) return res.status(409).json({ error: "exists" });
    const envs = Object.fromEntries(
      Object.entries(parsed.data.environments).map(([env, cfg]) => [
        env,
        {
          ...cfg,
          rules: cfg.rules.map((r) => ({ ...r, id: r.id ?? randomId() })),
        },
      ]),
    );
    const flag = await deps.flags.create({
      ...parsed.data,
      environments: envs,
    } as Omit<Flag, "_id" | "createdAt" | "updatedAt">);
    const actor = (req as Request & { user: AuthClaims }).user.sub;
    await deps.audit.record({ flagKey: flag.key, actor, action: "create" });
    const envKeys = Object.keys(flag.environments);
    const versions = envKeys.length
      ? await rebuildAndPublish(envKeys)
      : [];
    res.status(201).json({ flag, versions });
  });

  app.patch("/flags/:key/env/:env", auth("editor"), async (req, res) => {
    const parsed = envConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation", details: parsed.error.flatten() });
    }
    const key = String(req.params.key);
    const env = String(req.params.env);
    const before = await deps.flags.getByKey(key);
    if (!before) return res.status(404).json({ error: "not_found" });
    const patch = parsed.data;
    const ruleId = (rules: typeof patch.rules) =>
      (rules ?? []).map((r) => ({ ...r, id: r.id ?? randomId() }));
    const updateBody: Partial<Flag["environments"][string]> = {};
    if (patch.enabled !== undefined) updateBody.enabled = patch.enabled;
    if (patch.defaultVariant !== undefined)
      updateBody.defaultVariant = patch.defaultVariant;
    if (patch.rules !== undefined)
      updateBody.rules = ruleId(patch.rules) as Flag["environments"][string]["rules"];
    if (patch.rollout !== undefined) updateBody.rollout = patch.rollout;
    const updated = await deps.flags.updateEnvironment(key, env, updateBody);
    if (!updated) return res.status(404).json({ error: "not_found" });
    const actor = (req as Request & { user: AuthClaims }).user.sub;
    await deps.audit.record({
      flagKey: updated.key,
      env,
      actor,
      action: "update",
      diff: {
        environments: {
          before: before.environments[env],
          after: updated.environments[env],
        },
      },
    });
    const versions = await rebuildAndPublish([env]);
    res.json({ flag: updated, versions });
  });

  app.delete("/flags/:key", auth("editor"), async (req, res) => {
    const key = String(req.params.key);
    const before = await deps.flags.getByKey(key);
    if (!before) return res.status(404).json({ error: "not_found" });
    await deps.flags.remove(key);
    const actor = (req as Request & { user: AuthClaims }).user.sub;
    await deps.audit.record({ flagKey: before.key, actor, action: "delete" });
    const envs = Object.keys(before.environments);
    const versions = envs.length ? await rebuildAndPublish(envs) : [];
    res.json({ ok: true, versions });
  });

  app.post("/eval", auth(), async (req, res) => {
    const parsed = evalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation" });
    }
    const ruleset = await deps.publisher.fetchLatest(parsed.data.env);
    if (!ruleset) return res.status(404).json({ error: "no_ruleset" });
    const idx = new RulesetIndex(ruleset);
    const result = idx.evaluate(parsed.data.flag, parsed.data.context);
    res.json({ ...result, rulesetVersion: ruleset.version });
  });

  app.post("/admin/rebuild", auth("admin"), async (req, res) => {
    const env = String(req.body?.env ?? "");
    if (!env) return res.status(400).json({ error: "missing env" });
    const versions = await rebuildAndPublish([env]);
    res.json({ versions });
  });

  app.get("/audit", auth(), async (req, res) => {
    const flagKey = typeof req.query.flag === "string" ? req.query.flag : undefined;
    res.json(await deps.audit.list(flagKey));
  });

  return app;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}
