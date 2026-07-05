import { MongoClient, type Collection, type Db } from "mongodb";
import type {
  LogDoc,
  ServiceEdgeDoc,
  ServiceNodeDoc,
  SpanDoc,
  TraceDoc,
} from "./types.js";

export interface MongoHandles {
  client: MongoClient;
  db: Db;
  spans: Collection<SpanDoc>;
  logs: Collection<LogDoc>;
  traces: Collection<TraceDoc>;
  services: Collection<ServiceNodeDoc>;
  edges: Collection<ServiceEdgeDoc>;
}

export async function connectMongo(
  uri: string,
  dbName: string,
): Promise<MongoHandles> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const spans = db.collection<SpanDoc>("spans");
  const logs = db.collection<LogDoc>("logs");
  const traces = db.collection<TraceDoc>("traces");
  const services = db.collection<ServiceNodeDoc>("services");
  const edges = db.collection<ServiceEdgeDoc>("service_edges");

  await spans.createIndex({ traceId: 1 });
  await spans.createIndex({ serviceName: 1, startMs: -1 });
  await spans.createIndex({ "attributes.http.status_code": 1 });
  await traces.createIndex({ traceId: 1 }, { unique: true });
  await traces.createIndex({ rootService: 1, startMs: -1 });
  await traces.createIndex({ errorCount: 1, startMs: -1 });
  await traces.createIndex({ durationMs: -1, startMs: -1 });
  await services.createIndex({ name: 1 }, { unique: true });
  await edges.createIndex({ from: 1, to: 1 }, { unique: true });
  await logs.createIndex({ ts: -1 });
  await logs.createIndex({ traceId: 1 });

  return { client, db, spans, logs, traces, services, edges };
}
