import type { SamplingReason, SpanDoc, TraceDoc } from "../types.js";
import { ulid } from "ulid";

export interface SamplingPolicy {
  slowTraceMs: number;
  sampleRate: number;
}

export interface SamplingDecision {
  keep: boolean;
  reason: SamplingReason | "dropped";
  trace?: TraceDoc;
}

function pickRoot(spans: SpanDoc[]): SpanDoc | null {
  return (
    spans.find((s) => !s.parentSpanId) ??
    spans.slice().sort((a, b) => a.startMs - b.startMs)[0] ??
    null
  );
}

export function decide(
  spans: SpanDoc[],
  policy: SamplingPolicy,
  random: () => number = Math.random,
): SamplingDecision {
  if (spans.length === 0) {
    return { keep: false, reason: "dropped" };
  }
  const traceId = spans[0]!.traceId;
  const root = pickRoot(spans);
  const startMs = Math.min(...spans.map((s) => s.startMs));
  const endMs = Math.max(...spans.map((s) => s.endMs));
  const durationMs = Math.max(0, endMs - startMs);
  const errorCount = spans.filter((s) => s.status === "error").length;
  const services = [...new Set(spans.map((s) => s.serviceName))];

  let reason: SamplingReason | null = null;
  if (errorCount > 0) reason = "error";
  else if (durationMs >= policy.slowTraceMs) reason = "slow";
  else if (random() < policy.sampleRate) reason = "probabilistic";

  if (reason === null) {
    return { keep: false, reason: "dropped" };
  }

  const trace: TraceDoc = {
    _id: ulid(),
    traceId,
    startMs,
    endMs,
    durationMs,
    spanCount: spans.length,
    serviceCount: services.length,
    errorCount,
    services,
    sampledReason: reason,
    createdAt: Date.now(),
  };
  if (root?.name) trace.rootSpanName = root.name;
  if (root?.serviceName) trace.rootService = root.serviceName;

  return { keep: true, reason, trace };
}
