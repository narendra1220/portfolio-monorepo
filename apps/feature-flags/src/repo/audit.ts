import { ulid } from "ulid";
import type { MongoHandles } from "../mongo.js";
import type { AuditEntry } from "../types.js";

export class AuditRepo {
  constructor(private readonly mongo: MongoHandles) {}

  async record(entry: Omit<AuditEntry, "_id" | "ts">): Promise<AuditEntry> {
    const doc: AuditEntry = { _id: ulid(), ts: Date.now(), ...entry };
    await this.mongo.audit.insertOne(doc);
    return doc;
  }

  async list(flagKey?: string, limit = 50): Promise<AuditEntry[]> {
    const filter = flagKey ? { flagKey } : {};
    return this.mongo.audit.find(filter).sort({ ts: -1 }).limit(limit).toArray();
  }
}
