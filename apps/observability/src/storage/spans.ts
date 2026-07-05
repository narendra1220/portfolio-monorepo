import type { MongoHandles } from "../mongo.js";
import type {
  SpanDoc,
  TraceDoc,
} from "../types.js";

export class TraceStore {
  constructor(private readonly mongo: MongoHandles) {}

  async writeTrace(trace: TraceDoc, spans: SpanDoc[]): Promise<void> {
    if (spans.length > 0) await this.mongo.spans.insertMany(spans, { ordered: false });
    await this.mongo.traces.updateOne(
      { traceId: trace.traceId },
      { $setOnInsert: trace },
      { upsert: true },
    );
  }

  async getTrace(traceId: string): Promise<{
    trace: TraceDoc | null;
    spans: SpanDoc[];
  }> {
    const [trace, spans] = await Promise.all([
      this.mongo.traces.findOne({ traceId }),
      this.mongo.spans.find({ traceId }).sort({ startMs: 1 }).toArray(),
    ]);
    return { trace, spans };
  }

  async searchTraces(opts: {
    service?: string;
    hasErrors?: boolean;
    minDurationMs?: number;
    since?: number;
    limit?: number;
  }): Promise<TraceDoc[]> {
    const filter: Record<string, unknown> = {};
    if (opts.service) filter.services = opts.service;
    if (opts.hasErrors) filter.errorCount = { $gt: 0 };
    if (opts.minDurationMs) filter.durationMs = { $gte: opts.minDurationMs };
    if (opts.since) filter.startMs = { $gte: opts.since };
    const limit = Math.min(opts.limit ?? 50, 200);
    return this.mongo.traces
      .find(filter)
      .sort({ startMs: -1 })
      .limit(limit)
      .toArray();
  }
}
