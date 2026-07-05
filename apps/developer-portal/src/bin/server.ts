import http from "node:http";
import { loadConfig } from "../config.js";
import { connectMongo } from "../mongo.js";
import { makeRedis } from "../redis.js";
import { ServicesRepo } from "../repo/services.js";
import { makeOpenAPIFetcher } from "../openapi/fetch.js";
import { makeHealthChecker } from "../health/checker.js";
import { makePlaygroundProxy } from "../playground/proxy.js";
import { buildApp } from "../rest/app.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const mongo = await connectMongo(cfg.mongoUri, cfg.mongoDb);
  const redis = makeRedis(cfg.redisHost, cfg.redisPort);

  const services = new ServicesRepo(mongo);
  const openapi = makeOpenAPIFetcher(redis, cfg.openapiTtlSeconds);
  const health = makeHealthChecker(cfg.healthTimeoutMs);
  const playground = makePlaygroundProxy(cfg.playgroundTimeoutMs);

  const app = buildApp({
    services,
    openapi,
    health,
    playground,
    jwtSecret: cfg.jwtSecret,
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(cfg.port, resolve));
  console.log(JSON.stringify({ msg: "developer-portal up", port: cfg.port }));

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
