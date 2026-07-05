import { ulid } from "ulid";
import type { MongoHandles } from "../mongo.js";
import type { Flag, EnvironmentConfig } from "../types.js";

export class FlagsRepo {
  constructor(private readonly mongo: MongoHandles) {}

  async create(
    input: Omit<Flag, "_id" | "createdAt" | "updatedAt">,
  ): Promise<Flag> {
    const now = Date.now();
    const doc: Flag = { _id: ulid(), createdAt: now, updatedAt: now, ...input };
    await this.mongo.flags.insertOne(doc);
    return doc;
  }

  async list(): Promise<Flag[]> {
    return this.mongo.flags.find().sort({ key: 1 }).toArray();
  }

  async getByKey(key: string): Promise<Flag | null> {
    return this.mongo.flags.findOne({ key });
  }

  async updateEnvironment(
    key: string,
    env: string,
    patch: Partial<EnvironmentConfig>,
  ): Promise<Flag | null> {
    const flag = await this.mongo.flags.findOne({ key });
    if (!flag) return null;
    const merged: EnvironmentConfig = {
      ...(flag.environments[env] ?? {
        enabled: false,
        defaultVariant: flag.variants[0]?.key ?? "",
        rules: [],
      }),
      ...patch,
    };
    const update = {
      [`environments.${env}`]: merged,
      updatedAt: Date.now(),
    } as Record<string, unknown>;
    await this.mongo.flags.updateOne({ key }, { $set: update });
    return this.mongo.flags.findOne({ key });
  }

  async remove(key: string): Promise<boolean> {
    const r = await this.mongo.flags.deleteOne({ key });
    return r.deletedCount > 0;
  }
}
