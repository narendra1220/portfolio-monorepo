import { MongoClient, type Collection, type Db } from "mongodb";
import type { Service, ServiceVersionDoc } from "./types.js";

export interface MongoHandles {
  client: MongoClient;
  db: Db;
  services: Collection<Service>;
  versions: Collection<ServiceVersionDoc>;
}

export async function connectMongo(
  uri: string,
  dbName: string,
): Promise<MongoHandles> {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const services = db.collection<Service>("services");
  const versions = db.collection<ServiceVersionDoc>("service_versions");
  await services.createIndex({ id: 1 }, { unique: true });
  await services.createIndex({ tier: 1, lifecycle: 1 });
  await services.createIndex({ "owner.team": 1 });
  await services.createIndex({ tags: 1 });
  await versions.createIndex({ serviceId: 1, version: -1 });
  return { client, db, services, versions };
}
