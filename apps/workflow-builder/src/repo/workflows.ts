import { ulid } from "ulid";
import type { Db } from "../mongo.js";
import { emptyDoc, materialize } from "../ops/apply.js";
import type { Workflow, WorkflowDoc } from "../types.js";

export class WorkflowRepo {
  constructor(private readonly db: Db) {}

  async create(input: { name: string; ownerId: string }): Promise<Workflow> {
    const now = Date.now();
    const w: Workflow = {
      _id: ulid(),
      name: input.name,
      ownerId: input.ownerId,
      version: 1,
      snapshot: emptyDoc(),
      snapshotSeq: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.workflows.insertOne(w);
    return w;
  }

  async get(id: string): Promise<Workflow | null> {
    return await this.db.workflows.findOne({ _id: id });
  }

  async list(ownerId: string, limit = 50): Promise<Workflow[]> {
    return await this.db.workflows
      .find({ ownerId })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .toArray();
  }

  async rename(id: string, name: string): Promise<boolean> {
    const r = await this.db.workflows.updateOne(
      { _id: id },
      { $set: { name, updatedAt: Date.now() } },
    );
    return r.matchedCount > 0;
  }

  async remove(id: string): Promise<boolean> {
    const r = await this.db.workflows.deleteOne({ _id: id });
    await this.db.ops.deleteMany({ workflowId: id });
    return r.deletedCount > 0;
  }

  async updateSnapshot(
    id: string,
    snapshot: WorkflowDoc,
    snapshotSeq: number,
  ): Promise<void> {
    await this.db.workflows.updateOne(
      { _id: id },
      {
        $set: { snapshot, snapshotSeq, updatedAt: Date.now() },
        $inc: { version: 1 },
      },
    );
  }

  async hydrate(id: string): Promise<{ doc: WorkflowDoc; seq: number } | null> {
    const w = await this.get(id);
    if (!w) return null;
    const ops = await this.db.ops
      .find({ workflowId: id, seq: { $gt: w.snapshotSeq } })
      .sort({ seq: 1 })
      .toArray();
    const doc = materialize(w.snapshot, ops.map((e) => e.op));
    const seq = ops.length > 0 ? ops[ops.length - 1]!.seq : w.snapshotSeq;
    return { doc, seq };
  }
}
