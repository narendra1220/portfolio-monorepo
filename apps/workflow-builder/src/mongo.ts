import { MongoClient, Collection } from "mongodb";
import type { Workflow, OpEnvelope, Run } from "./types.js";

export interface Db {
  client: MongoClient;
  workflows: Collection<Workflow>;
  ops: Collection<OpEnvelope>;
  runs: Collection<Run>;
}

export async function connectMongo(uri: string, dbName: string): Promise<Db> {
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    maxPoolSize: 50,
  });
  await client.connect();
  const db = client.db(dbName);
  const workflows = db.collection<Workflow>("workflows");
  const ops = db.collection<OpEnvelope>("workflow_ops");
  const runs = db.collection<Run>("workflow_runs");

  await Promise.all([
    workflows.createIndex({ ownerId: 1, updatedAt: -1 }),
    ops.createIndex({ workflowId: 1, seq: 1 }, { unique: true }),
    ops.createIndex({ workflowId: 1, ts: 1 }),
    runs.createIndex({ workflowId: 1, startedAt: -1 }),
    runs.createIndex({ status: 1 }),
  ]);

  return { client, workflows, ops, runs };
}

export async function closeMongo(db: Db): Promise<void> {
  await db.client.close();
}
