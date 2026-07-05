import type { MongoHandles } from "../mongo.js";

export class MetaRepo {
  constructor(private readonly mongo: MongoHandles) {}

  async nextVersion(env: string): Promise<number> {
    const r = await this.mongo.meta.findOneAndUpdate(
      { _id: `ruleset:${env}` },
      { $inc: { version: 1 } },
      { upsert: true, returnDocument: "after" },
    );
    return r?.version ?? 1;
  }

  async getVersion(env: string): Promise<number> {
    const r = await this.mongo.meta.findOne({ _id: `ruleset:${env}` });
    return r?.version ?? 0;
  }
}
