import { MongoClient, type Collection, type Db } from "mongodb";
import type { AuditEntry, Flag } from "./types.js";

export interface MongoHandles {
  client: MongoClient;
  db: Db;
  flags: Collection<Flag>;
  audit: Collection<AuditEntry>;
  meta: Collection<{ _id: string; version: number }>;
}

export async function connectMongo(
  uri: string,
  dbName: string,
): Promise<MongoHandles> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const flags = db.collection<Flag>("flags");
  const audit = db.collection<AuditEntry>("audit");
  const meta = db.collection<{ _id: string; version: number }>("meta");
  await flags.createIndex({ key: 1 }, { unique: true });
  await audit.createIndex({ ts: -1 });
  await audit.createIndex({ flagKey: 1, ts: -1 });
  return { client, db, flags, audit, meta };
}
