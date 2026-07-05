import express, { type Express, type Request, type Response, type NextFunction } from "express";
import type { WorkflowRepo } from "../repo/workflows.js";
import type { RunRepo } from "../repo/runs.js";
import { verifyToken, signToken, type Principal } from "../auth.js";
import type { Queue } from "@portfolio/job-queue";

export interface RestDeps {
  workflows: WorkflowRepo;
  runs: RunRepo;
  queue: Queue;
  jwtSecret: string;
}

export function buildApp(deps: RestDeps): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
  });

  app.post("/auth/dev-token", (req, res) => {
    const sub = String(req.body?.sub ?? "anonymous");
    const name = typeof req.body?.name === "string" ? req.body.name : undefined;
    const token = signToken(deps.jwtSecret, { sub, name }, 24 * 3600);
    res.json({ token, sub, name });
  });

  app.use((req, res, next) => {
    if (req.path === "/health" || req.path.startsWith("/auth/")) return next();
    const header = req.header("authorization");
    if (!header || !header.startsWith("Bearer ")) {
      res.status(401).json({ error: "missing bearer token" });
      return;
    }
    try {
      const principal = verifyToken(deps.jwtSecret, header.slice(7));
      (req as Request & { principal: Principal }).principal = principal;
      next();
    } catch {
      res.status(401).json({ error: "invalid token" });
    }
  });

  const getPrincipal = (req: Request): Principal =>
    (req as Request & { principal: Principal }).principal;

  app.get("/api/workflows", async (req, res, next) => {
    try {
      const wfs = await deps.workflows.list(getPrincipal(req).sub);
      res.json({ workflows: wfs });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/workflows", async (req, res, next) => {
    try {
      const name = String(req.body?.name ?? "Untitled workflow").slice(0, 200);
      const w = await deps.workflows.create({
        name,
        ownerId: getPrincipal(req).sub,
      });
      res.status(201).json({ workflow: w });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/workflows/:id", async (req, res, next) => {
    try {
      const w = await deps.workflows.get(req.params.id!);
      if (!w) {
        res.status(404).json({ error: "not found" });
        return;
      }
      const hydrated = await deps.workflows.hydrate(req.params.id!);
      res.json({
        workflow: w,
        doc: hydrated?.doc,
        seq: hydrated?.seq ?? 0,
      });
    } catch (e) {
      next(e);
    }
  });

  app.patch("/api/workflows/:id", async (req, res, next) => {
    try {
      if (typeof req.body?.name === "string") {
        await deps.workflows.rename(req.params.id!, req.body.name);
      }
      const w = await deps.workflows.get(req.params.id!);
      res.json({ workflow: w });
    } catch (e) {
      next(e);
    }
  });

  app.delete("/api/workflows/:id", async (req, res, next) => {
    try {
      const ok = await deps.workflows.remove(req.params.id!);
      res.json({ ok });
    } catch (e) {
      next(e);
    }
  });

  app.post("/api/workflows/:id/runs", async (req, res, next) => {
    try {
      const w = await deps.workflows.get(req.params.id!);
      if (!w) {
        res.status(404).json({ error: "workflow not found" });
        return;
      }
      const run = await deps.runs.create({
        workflowId: w._id,
        version: w.version,
        actor: getPrincipal(req).sub,
        input: req.body?.input ?? {},
      });
      await deps.queue.add("workflow.run", { runId: run._id });
      res.status(202).json({ run });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/workflows/:id/runs", async (req, res, next) => {
    try {
      const runs = await deps.runs.listByWorkflow(req.params.id!);
      res.json({ runs });
    } catch (e) {
      next(e);
    }
  });

  app.get("/api/runs/:id", async (req, res, next) => {
    try {
      const run = await deps.runs.get(req.params.id!);
      if (!run) {
        res.status(404).json({ error: "not found" });
        return;
      }
      res.json({ run });
    } catch (e) {
      next(e);
    }
  });

  app.use(
    (
      err: unknown,
      _req: Request,
      res: Response,
      _next: NextFunction,
    ): void => {
      const msg = err instanceof Error ? err.message : String(err);
      res.status(500).json({ error: msg });
    },
  );

  return app;
}
