import express, { type Request, type Response } from "express";
import type { TraceBuffer } from "../ingest/buffer.js";
import { parseOtlpLogs, parseOtlpTraces } from "../otlp/parse.js";
import type { ServiceMapStore } from "../storage/services.js";
import type { TraceStore } from "../storage/spans.js";
import type { IngestStats, LogDoc } from "../types.js";
import type { MongoHandles } from "../mongo.js";

export interface AppDeps {
  buffer: TraceBuffer;
  traceStore: TraceStore;
  serviceStore: ServiceMapStore;
  mongo: MongoHandles;
  stats: IngestStats;
}

export function buildApp(deps: AppDeps): express.Express {
  const app = express();
  app.use(express.json({ limit: "8mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.post("/v1/traces", async (req, res) => {
    try {
      const spans = parseOtlpTraces(req.body);
      for (const s of spans) deps.buffer.add(s);
      deps.stats.spansReceived += spans.length;
      deps.stats.tracesBuffered = deps.buffer.size();
      res.json({ acceptedSpans: spans.length });
    } catch (e) {
      res.status(400).json({ error: "parse_failed", details: (e as Error).message });
    }
  });

  app.post("/v1/logs", async (req, res) => {
    try {
      const logs = parseOtlpLogs(req.body);
      if (logs.length > 0) {
        await deps.mongo.logs.insertMany(logs as LogDoc[], { ordered: false });
      }
      deps.stats.logsReceived += logs.length;
      res.json({ acceptedLogs: logs.length });
    } catch (e) {
      res.status(400).json({ error: "parse_failed", details: (e as Error).message });
    }
  });

  app.get("/traces", async (req, res) => {
    const items = await deps.traceStore.searchTraces({
      service: qstr(req, "service"),
      hasErrors: req.query.hasErrors === "true",
      minDurationMs: qnum(req, "minDurationMs"),
      since: qnum(req, "since"),
      limit: qnum(req, "limit"),
    });
    res.json({ count: items.length, items });
  });

  app.get("/trace/:id", async (req, res) => {
    const { trace, spans } = await deps.traceStore.getTrace(
      String(req.params.id),
    );
    if (!trace) return res.status(404).json({ error: "not_found" });
    const childrenByParent: Record<string, string[]> = {};
    for (const s of spans) {
      if (s.parentSpanId) {
        (childrenByParent[s.parentSpanId] ??= []).push(s.spanId);
      }
    }
    res.json({ trace, spans, childrenByParent });
  });

  app.get("/services", async (_req, res) => {
    const items = await deps.serviceStore.services();
    res.json({ count: items.length, items });
  });

  app.get("/servicemap", async (_req, res) => {
    const [nodes, edges] = await Promise.all([
      deps.serviceStore.services(),
      deps.serviceStore.edges(),
    ]);
    res.json({
      nodes: nodes.map((n) => ({
        name: n.name,
        traceCount: n.traceCount,
        errorCount: n.errorCount,
        avgDurationMs: round(n.avgDurationMs),
        lastSeen: n.lastSeen,
      })),
      edges: edges.map((e) => ({
        from: e.from,
        to: e.to,
        callCount: e.callCount,
        errorCount: e.errorCount,
        avgLatencyMs: round(e.avgLatencyMs),
      })),
    });
  });

  app.get("/stats", (_req, res) => {
    res.json({ ...deps.stats, tracesBuffered: deps.buffer.size() });
  });

  app.get("/logs", async (req, res) => {
    const traceId = qstr(req, "traceId");
    const since = qnum(req, "since");
    const limit = Math.min(qnum(req, "limit") ?? 50, 500);
    const filter: Record<string, unknown> = {};
    if (traceId) filter.traceId = traceId;
    if (since) filter.ts = { $gte: since };
    const items = await deps.mongo.logs
      .find(filter)
      .sort({ ts: -1 })
      .limit(limit)
      .toArray();
    res.json({ count: items.length, items });
  });

  return app;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function qstr(req: Request, key: string): string | undefined {
  const v = req.query[key];
  return typeof v === "string" ? v : undefined;
}
function qnum(req: Request, key: string): number | undefined {
  const v = req.query[key];
  if (typeof v !== "string") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export type { Response };
