import type {
  Run,
  RunStep,
  Workflow,
  WorkflowDoc,
  WorkflowEdge,
  WorkflowNode,
} from "../types.js";
import { httpNode } from "./nodes/http.js";
import { transformNode } from "./nodes/transform.js";
import { branchNode } from "./nodes/branch.js";
import { logNode } from "./nodes/log.js";
import { startNode } from "./nodes/start.js";
import type { RunRepo } from "../repo/runs.js";

export type Branch = "default" | "true" | "false";

export interface RunCtx {
  node: WorkflowNode;
  input: unknown;
  vars: Record<string, unknown>;
  log: (msg: string) => void;
  render: (template: string) => string;
}

export type NodeRunner = (ctx: RunCtx) => Promise<{
  output: unknown;
  next?: Branch;
}>;

const runners: Record<string, NodeRunner> = {
  start: startNode,
  http: httpNode,
  transform: transformNode,
  branch: branchNode,
  log: logNode,
};

const MAX_STEPS = 200;

function findStart(doc: WorkflowDoc): WorkflowNode | null {
  for (const n of Object.values(doc.nodes)) {
    if (n.kind === "start") return n;
  }
  const inbound = new Set<string>();
  for (const e of Object.values(doc.edges)) inbound.add(e.to);
  for (const n of Object.values(doc.nodes)) {
    if (!inbound.has(n.id)) return n;
  }
  return null;
}

function nextEdges(doc: WorkflowDoc, from: string): WorkflowEdge[] {
  return Object.values(doc.edges).filter((e) => e.from === from);
}

function pickEdge(
  edges: WorkflowEdge[],
  branch: Branch,
): WorkflowEdge | undefined {
  const exact = edges.find((e) => e.branch === branch);
  if (exact) return exact;
  return edges.find((e) => !e.branch || e.branch === "default");
}

function templateRenderer(vars: Record<string, unknown>) {
  return (template: string): string =>
    template.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, expr: string) => {
      const trimmed = expr.trim();
      const parts = trimmed.split(".");
      let cur: unknown = vars;
      for (const p of parts) {
        if (cur && typeof cur === "object" && p in (cur as object)) {
          cur = (cur as Record<string, unknown>)[p];
        } else {
          return "";
        }
      }
      return cur == null ? "" : String(cur);
    });
}

export async function executeWorkflow(
  workflow: Workflow,
  doc: WorkflowDoc,
  run: Run,
  repo: RunRepo,
): Promise<{ status: "succeeded" | "failed"; error?: string; output: unknown }> {
  await repo.setStatus(run._id, "running", { startedAt: Date.now() });

  const vars: Record<string, unknown> = { input: run.input ?? {} };
  let cursor: WorkflowNode | null = findStart(doc);
  if (!cursor) {
    return { status: "failed", error: "no start node", output: null };
  }

  let stepsExecuted = 0;
  let lastOutput: unknown = run.input;

  while (cursor && stepsExecuted < MAX_STEPS) {
    const runner = runners[cursor.kind];
    if (!runner) {
      const err = `unknown node kind: ${cursor.kind}`;
      const step: RunStep = {
        nodeId: cursor.id,
        status: "failed",
        startedAt: Date.now(),
        endedAt: Date.now(),
        error: err,
      };
      await repo.pushStep(run._id, step);
      return { status: "failed", error: err, output: null };
    }

    const startedAt = Date.now();
    const logs: string[] = [];
    const step: RunStep = { nodeId: cursor.id, status: "running", startedAt, logs };
    await repo.pushStep(run._id, step);

    let next: Branch = "default";
    let nodeOutput: unknown = null;
    try {
      const ctx: RunCtx = {
        node: cursor,
        input: lastOutput,
        vars,
        log: (m) => logs.push(`[${new Date().toISOString()}] ${m}`),
        render: templateRenderer({ ...vars, last: lastOutput }),
      };
      const res = await runner(ctx);
      nodeOutput = res.output;
      next = res.next ?? "default";
      vars[cursor.id] = nodeOutput;
      lastOutput = nodeOutput;
      await repo.patchStep(run._id, cursor.id, {
        status: "succeeded",
        endedAt: Date.now(),
        output: nodeOutput,
        logs,
      });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      await repo.patchStep(run._id, cursor.id, {
        status: "failed",
        endedAt: Date.now(),
        error: err,
        logs,
      });
      return { status: "failed", error: err, output: lastOutput };
    }

    stepsExecuted++;
    const edges = nextEdges(doc, cursor.id);
    const picked = pickEdge(edges, next);
    if (!picked) break;
    cursor = doc.nodes[picked.to] ?? null;
  }

  if (stepsExecuted >= MAX_STEPS) {
    return {
      status: "failed",
      error: `step budget exhausted (${MAX_STEPS})`,
      output: lastOutput,
    };
  }
  return { status: "succeeded", output: lastOutput };
}
