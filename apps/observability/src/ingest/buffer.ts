import type { SpanDoc } from "../types.js";

interface BufferedTrace {
  traceId: string;
  spans: SpanDoc[];
  lastSpanAt: number;
}

export class TraceBuffer {
  private buckets = new Map<string, BufferedTrace>();

  add(span: SpanDoc): void {
    let trace = this.buckets.get(span.traceId);
    if (!trace) {
      trace = {
        traceId: span.traceId,
        spans: [],
        lastSpanAt: Date.now(),
      };
      this.buckets.set(span.traceId, trace);
    }
    trace.spans.push(span);
    trace.lastSpanAt = Date.now();
  }

  size(): number {
    return this.buckets.size;
  }

  drainIdle(maxIdleMs: number): BufferedTrace[] {
    const now = Date.now();
    const ready: BufferedTrace[] = [];
    for (const [id, trace] of this.buckets) {
      if (now - trace.lastSpanAt >= maxIdleMs) {
        ready.push(trace);
        this.buckets.delete(id);
      }
    }
    return ready;
  }

  drainAll(): BufferedTrace[] {
    const all = [...this.buckets.values()];
    this.buckets.clear();
    return all;
  }
}

export type { BufferedTrace };
