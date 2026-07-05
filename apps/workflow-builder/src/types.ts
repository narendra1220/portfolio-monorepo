export type NodeKind = "http" | "transform" | "branch" | "log" | "start";

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  props: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
  branch?: "true" | "false" | "default";
}

export interface WorkflowDoc {
  nodes: Record<string, WorkflowNode>;
  edges: Record<string, WorkflowEdge>;
}

export type OpKind =
  | "node.add"
  | "node.move"
  | "node.delete"
  | "node.prop"
  | "edge.add"
  | "edge.delete";

export interface OpBase {
  kind: OpKind;
  actor: string;
}

export interface OpNodeAdd extends OpBase {
  kind: "node.add";
  node: WorkflowNode;
}
export interface OpNodeMove extends OpBase {
  kind: "node.move";
  id: string;
  x: number;
  y: number;
}
export interface OpNodeDelete extends OpBase {
  kind: "node.delete";
  id: string;
}
export interface OpNodeProp extends OpBase {
  kind: "node.prop";
  id: string;
  key: string;
  value: unknown;
}
export interface OpEdgeAdd extends OpBase {
  kind: "edge.add";
  edge: WorkflowEdge;
}
export interface OpEdgeDelete extends OpBase {
  kind: "edge.delete";
  id: string;
}

export type Op =
  | OpNodeAdd
  | OpNodeMove
  | OpNodeDelete
  | OpNodeProp
  | OpEdgeAdd
  | OpEdgeDelete;

export interface OpEnvelope {
  workflowId: string;
  seq: number;
  op: Op;
  ts: number;
}

export interface Workflow {
  _id: string;
  name: string;
  ownerId: string;
  version: number;
  snapshot: WorkflowDoc;
  snapshotSeq: number;
  createdAt: number;
  updatedAt: number;
}

export type RunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface RunStep {
  nodeId: string;
  status: "pending" | "running" | "succeeded" | "failed" | "skipped";
  startedAt?: number;
  endedAt?: number;
  output?: unknown;
  error?: string;
  logs?: string[];
}

export interface Run {
  _id: string;
  workflowId: string;
  version: number;
  status: RunStatus;
  trigger: { kind: "manual" | "api"; actor: string };
  startedAt?: number;
  endedAt?: number;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  steps: RunStep[];
}

export interface Presence {
  actor: string;
  cursor?: { x: number; y: number };
  selection?: string[];
  ts: number;
}
