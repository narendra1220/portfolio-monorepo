import http from "node:http";
import { loadConfig } from "../config.js";
import { connectMongo } from "../mongo.js";
import { makeRedis } from "../redis.js";
import { FlagsRepo } from "../repo/flags.js";
import { AuditRepo } from "../repo/audit.js";
import { MetaRepo } from "../repo/meta.js";
import { RulesetPublisher } from "../bus/publisher.js";
import { buildApp } from "../rest/app.js";
import { mountSSE } from "../sse/edge.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const mongo = await connectMongo(cfg.mongoUri, cfg.mongoDb);
  const redis = makeRedis(cfg.redisHost, cfg.redisPort);
  const flags = new FlagsRepo(mongo);
  const audit = new AuditRepo(mongo);
  const meta = new MetaRepo(mongo);
  const publisher = new RulesetPublisher(redis);

  const app = buildApp({
    flags,
    audit,
    meta,
    publisher,
    jwtSecret: cfg.jwtSecret,
    defaultEnvs: ["dev", "prod"],
  });
  mountSSE(app, {
    publisher,
    redisFactory: () => makeRedis(cfg.redisHost, cfg.redisPort),
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(cfg.port, resolve));
  console.log(JSON.stringify({ msg: "feature-flags up", port: cfg.port }));

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ msg: "shutting down", signal }));
    server.close();
    await mongo.client.close();
    redis.disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
