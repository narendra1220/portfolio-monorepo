import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { z } from "zod";
import { signToken, verifyToken, type AuthClaims } from "../auth.js";
import { safeParseManifest } from "../catalog/validator.js";
import type { HealthChecker } from "../health/checker.js";
import type { OpenAPIFetcher } from "../openapi/fetch.js";
import type { PlaygroundProxy } from "../playground/proxy.js";
import type { ServicesRepo } from "../repo/services.js";

export interface AppDeps {
  services: ServicesRepo;
  openapi: OpenAPIFetcher;
  health: HealthChecker;
  playground: PlaygroundProxy;
  jwtSecret: string;
}

const playgroundSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  query: z.record(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export function buildApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/auth/dev-token", (req, res) => {
    const { sub, role, teams } = req.body ?? {};
    const claims: AuthClaims = {
      sub: typeof sub === "string" ? sub : "dev",
      role: role === "viewer" || role === "editor" ? role : "admin",
      teams: Array.isArray(teams) ? teams : undefined,
    };
    res.json({ token: signToken(claims, deps.jwtSecret), claims });
  });

  function auth(role?: AuthClaims["role"]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const h = req.headers.authorization;
      if (!h?.startsWith("Bearer ")) {
        return res.status(401).json({ error: "missing_token" });
      }
      try {
        const claims = verifyToken(h.slice(7), deps.jwtSecret);
        if (
          role &&
          claims.role !== role &&
          !(role === "viewer" && claims.role === "editor") &&
          claims.role !== "admin"
        ) {
          return res.status(403).json({ error: "insufficient_role" });
        }
        (req as Request & { user: AuthClaims }).user = claims;
        next();
      } catch {
        res.status(401).json({ error: "invalid_token" });
      }
    };
  }

  app.get("/services", auth("viewer"), async (req, res) => {
    const list = await deps.services.search({
      query: queryString(req, "q"),
      tier: queryString(req, "tier"),
      lifecycle: queryString(req, "lifecycle"),
      team: queryString(req, "team"),
      tag: queryString(req, "tag"),
      limit: Number(queryString(req, "limit")) || undefined,
    });
    res.json({ count: list.length, items: list });
  });

  app.get("/services/:id", auth("viewer"), async (req, res) => {
    const svc = await deps.services.getById(String(req.params.id));
    if (!svc) return res.status(404).json({ error: "not_found" });
    res.json(svc);
  });

  app.get("/services/:id/versions", auth("viewer"), async (req, res) => {
    const versions = await deps.services.listVersions(String(req.params.id));
    res.json({ count: versions.length, items: versions });
  });

  app.post("/manifests", auth("editor"), async (req, res) => {
    const parsed = safeParseManifest(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: "validation", details: parsed.errors });
    }
    const actor = (req as Request & { user: AuthClaims }).user.sub;
    const result = await deps.services.upsertManifest(parsed.manifest, actor);
    if (result.versionBumped) await deps.openapi.invalidate(parsed.manifest.id);
    res.status(result.created ? 201 : 200).json(result);
  });

  app.delete("/services/:id", auth("editor"), async (req, res) => {
    const id = String(req.params.id);
    const ok = await deps.services.remove(id);
    if (!ok) return res.status(404).json({ error: "not_found" });
    await deps.openapi.invalidate(id);
    res.json({ ok: true });
  });

  app.get("/services/:id/openapi", auth("viewer"), async (req, res) => {
    const svc = await deps.services.getById(String(req.params.id));
    if (!svc) return res.status(404).json({ error: "not_found" });
    if (!svc.openapiUrl)
      return res.status(404).json({ error: "no_openapi_url" });
    try {
      const fetched = await deps.openapi.fetch(svc.id, svc.openapiUrl);
      res.json(fetched);
    } catch (e) {
      res.status(502).json({ error: "openapi_fetch_failed", details: (e as Error).message });
    }
  });

  app.post("/services/:id/openapi/refresh", auth("editor"), async (req, res) => {
    const id = String(req.params.id);
    const svc = await deps.services.getById(id);
    if (!svc) return res.status(404).json({ error: "not_found" });
    if (!svc.openapiUrl)
      return res.status(404).json({ error: "no_openapi_url" });
    await deps.openapi.invalidate(id);
    try {
      const fetched = await deps.openapi.fetch(svc.id, svc.openapiUrl);
      res.json(fetched);
    } catch (e) {
      res.status(502).json({ error: "openapi_fetch_failed", details: (e as Error).message });
    }
  });

  app.get("/health-rollup", auth("viewer"), async (_req, res) => {
    const all = await deps.services.list();
    const results = await deps.health.checkAll(all);
    const summary = results.reduce<Record<string, number>>((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1;
      return acc;
    }, {});
    res.json({
      checkedAt: Date.now(),
      total: results.length,
      summary,
      results,
    });
  });

  app.post("/services/:id/playground", auth("editor"), async (req, res) => {
    const svc = await deps.services.getById(String(req.params.id));
    if (!svc) return res.status(404).json({ error: "not_found" });
    const parsed = playgroundSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "validation", details: parsed.error.flatten() });
    }
    try {
      const result = await deps.playground.forward(svc, {
        serviceId: svc.id,
        ...parsed.data,
      });
      res.json(result);
    } catch (e) {
      res.status(502).json({ error: "upstream_failed", details: (e as Error).message });
    }
  });

  return app;
}

function queryString(req: Request, key: string): string | undefined {
  const v = req.query[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && typeof v[0] === "string") return v[0];
  return undefined;
}
