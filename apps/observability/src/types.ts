export type SpanKind =
  | "internal"
  | "server"
  | "client"
  | "producer"
  | "consumer";

export type SpanStatus = "unset" | "ok" | "error";

export interface SpanAttrs {
  [key: string]: string | number | boolean;
}

export interface SpanDoc {
  _id: string;
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  serviceName: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  status: SpanStatus;
  statusMessage?: string;
  attributes: SpanAttrs;
  resourceAttributes: SpanAttrs;
  ingestedAt: number;
}

export interface LogDoc {
  _id: string;
  traceId?: string;
  spanId?: string;
  ts: number;
  severity: string;
  body: string;
  serviceName: string;
  attributes: SpanAttrs;
  ingestedAt: number;
}

export type SamplingReason =
  | "error"
  | "slow"
  | "probabilistic"
  | "explicit_keep";

export interface TraceDoc {
  _id: string;
  traceId: string;
  rootSpanName?: string;
  rootService?: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  spanCount: number;
  serviceCount: number;
  errorCount: number;
  services: string[];
  sampledReason: SamplingReason;
  createdAt: number;
}

export interface ServiceNodeDoc {
  _id: string;
  name: string;
  firstSeen: number;
  lastSeen: number;
  traceCount: number;
  errorCount: number;
  avgDurationMs: number;
}

export interface ServiceEdgeDoc {
  _id: string;
  from: string;
  to: string;
  callCount: number;
  errorCount: number;
  avgLatencyMs: number;
  lastSeen: number;
}

export interface IngestStats {
  spansReceived: number;
  logsReceived: number;
  tracesBuffered: number;
  tracesFlushed: number;
  tracesDropped: number;
  byReason: Record<SamplingReason | "dropped", number>;
}
