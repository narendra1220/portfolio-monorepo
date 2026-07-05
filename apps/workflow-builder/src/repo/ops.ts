import type { Db } from "../mongo.js";
import type { Op, OpEnvelope } from "../types.js";

export class OpRepo {
  constructor(private readonly db: Db) {}

  async nextSeq(workflowId: string): Promise<number> {
    const last = await this.db.ops
      .find({ workflowId })
      .project<{ seq: number }>({ seq: 1 })
      .sort({ seq: -1 })
      .limit(1)
      .next();
    return (last?.seq ?? 0) + 1;
  }

  async append(workflowId: string, op: Op): Promise<OpEnvelope> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const seq = await this.nextSeq(workflowId);
      const env: OpEnvelope = { workflowId, seq, op, ts: Date.now() };
      try {
        await this.db.ops.insertOne(env);
        return env;
      } catch (err) {
        const msg = (err as Error).message;
        if (!msg.includes("E11000")) throw err;
      }
    }
    throw new Error("failed to append op after 5 retries (high contention)");
  }

  async since(workflowId: string, sinceSeq: number, limit = 500): Promise<OpEnvelope[]> {
    return await this.db.ops
      .find({ workflowId, seq: { $gt: sinceSeq } })
      .sort({ seq: 1 })
      .limit(limit)
      .toArray();
  }
}
