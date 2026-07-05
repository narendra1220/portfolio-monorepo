import type { MongoHandles } from "../mongo.js";
import type {
  ServiceEdgeDoc,
  ServiceNodeDoc,
  SpanDoc,
  TraceDoc,
} from "../types.js";
import { ulid } from "ulid";

export class ServiceMapStore {
  constructor(private readonly mongo: MongoHandles) {}

  async materialize(trace: TraceDoc, spans: SpanDoc[]): Promise<void> {
    const byService = new Map<string, { count: number; total: number; errors: number }>();
    const spanById = new Map<string, SpanDoc>();
    for (const s of spans) spanById.set(s.spanId, s);
    for (const s of spans) {
      const cur = byService.get(s.serviceName) ?? { count: 0, total: 0, errors: 0 };
      cur.count += 1;
      cur.total += s.durationMs;
      if (s.status === "error") cur.errors += 1;
      byService.set(s.serviceName, cur);
    }
    for (const [name, stats] of byService) {
      await this.mongo.services.updateOne(
        { name },
        {
          $setOnInsert: { _id: ulid(), firstSeen: trace.startMs },
          $set: { lastSeen: trace.endMs },
          $inc: {
            traceCount: 1,
            errorCount: stats.errors,
            avgDurationMs: 0,
          },
        },
        { upsert: true },
      );
      await this.mongo.services.updateOne(
        { name },
        [
          {
            $set: {
              avgDurationMs: {
                $cond: [
                  { $gt: ["$traceCount", 0] },
                  {
                    $divide: [
                      {
                        $add: [
                          {
                            $multiply: [
                              { $ifNull: ["$avgDurationMs", 0] },
                              { $subtract: ["$traceCount", 1] },
                            ],
                          },
                          stats.total / stats.count,
                        ],
                      },
                      "$traceCount",
                    ],
                  },
                  stats.total / stats.count,
                ],
              },
            },
          },
        ],
      );
    }
    const edgeAgg = new Map<string, { count: number; total: number; errors: number; lastSeen: number }>();
    for (const s of spans) {
      if (!s.parentSpanId) continue;
      const parent = spanById.get(s.parentSpanId);
      if (!parent) continue;
      if (parent.serviceName === s.serviceName) continue;
      const key = `${parent.serviceName}->${s.serviceName}`;
      const cur = edgeAgg.get(key) ?? { count: 0, total: 0, errors: 0, lastSeen: 0 };
      cur.count += 1;
      cur.total += s.durationMs;
      if (s.status === "error") cur.errors += 1;
      cur.lastSeen = Math.max(cur.lastSeen, s.endMs);
      edgeAgg.set(key, cur);
    }
    for (const [key, stats] of edgeAgg) {
      const [from, to] = key.split("->");
      if (!from || !to) continue;
      await this.mongo.edges.updateOne(
        { from, to },
        {
          $setOnInsert: { _id: ulid() },
          $set: { lastSeen: stats.lastSeen },
          $inc: { callCount: stats.count, errorCount: stats.errors },
        },
        { upsert: true },
      );
      await this.mongo.edges.updateOne(
        { from, to },
        [
          {
            $set: {
              avgLatencyMs: {
                $cond: [
                  { $gt: ["$callCount", 0] },
                  {
                    $divide: [
                      {
                        $add: [
                          {
                            $multiply: [
                              { $ifNull: ["$avgLatencyMs", 0] },
                              { $subtract: ["$callCount", stats.count] },
                            ],
                          },
                          stats.total,
                        ],
                      },
                      "$callCount",
                    ],
                  },
                  stats.total / Math.max(1, stats.count),
                ],
              },
            },
          },
        ],
      );
    }
  }

  async services(): Promise<ServiceNodeDoc[]> {
    return this.mongo.services.find().sort({ name: 1 }).toArray();
  }

  async edges(): Promise<ServiceEdgeDoc[]> {
    return this.mongo.edges.find().sort({ callCount: -1 }).toArray();
  }
}
