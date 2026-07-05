import { ulid } from "ulid";
import type { Db } from "../mongo.js";
import type { Run, RunStatus, RunStep } from "../types.js";

export class RunRepo {
  constructor(private readonly db: Db) {}

  async create(input: {
    workflowId: string;
    version: number;
    actor: string;
    input?: Record<string, unknown>;
  }): Promise<Run> {
    const run: Run = {
      _id: ulid(),
      workflowId: input.workflowId,
      version: input.version,
      status: "queued",
      trigger: { kind: "manual", actor: input.actor },
      input: input.input,
      steps: [],
    };
    await this.db.runs.insertOne(run);
    return run;
  }

  async get(id: string): Promise<Run | null> {
    return await this.db.runs.findOne({ _id: id });
  }

  async listByWorkflow(workflowId: string, limit = 30): Promise<Run[]> {
    return await this.db.runs
      .find({ workflowId })
      .sort({ _id: -1 })
      .limit(limit)
      .toArray();
  }

  async setStatus(id: string, status: RunStatus, extra: Partial<Run> = {}): Promise<void> {
    await this.db.runs.updateOne(
      { _id: id },
      { $set: { status, ...extra } },
    );
  }

  async pushStep(id: string, step: RunStep): Promise<void> {
    await this.db.runs.updateOne(
      { _id: id },
      { $push: { steps: step } },
    );
  }

  async patchStep(
    id: string,
    nodeId: string,
    patch: Partial<RunStep>,
  ): Promise<void> {
    const set: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      set[`steps.$.${k}`] = v;
    }
    await this.db.runs.updateOne(
      { _id: id, "steps.nodeId": nodeId },
      { $set: set },
    );
  }
}
