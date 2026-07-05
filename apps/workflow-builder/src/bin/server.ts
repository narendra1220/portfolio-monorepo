import { createServer } from "node:http";
import { loadConfig } from "../config.js";
import { connectMongo, closeMongo } from "../mongo.js";
import { createRedis } from "../redis.js";
import { WorkflowRepo } from "../repo/workflows.js";
import { OpRepo } from "../repo/ops.js";
import { RunRepo } from "../repo/runs.js";
import { PresenceTracker } from "../presence/tracker.js";
import { buildApp } from "../rest/app.js";
import { attachGateway } from "../socket/gateway.js";
import { Queue, createRedis as createJobQueueRedis } from "@portfolio/job-queue";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const db = await connectMongo(cfg.mongoUri, cfg.mongoDb);
  const pub = createRedis(cfg.redisHost, cfg.redisPort);
  const sub = pub.duplicate();
  const jobRedis = createJobQueueRedis({ host: cfg.redisHost, port: cfg.redisPort });

  const workflows = new WorkflowRepo(db);
  const ops = new OpRepo(db);
  const runs = new RunRepo(db);
  const presence = new PresenceTracker(pub);
  const queue = new Queue(jobRedis, {
    name: cfg.queueName,
    defaultMaxAttempts: 3,
    defaultTimeoutMs: 60_000,
  });

  const app = buildApp({ workflows, runs, queue, jwtSecret: cfg.jwtSecret });
  const http = createServer(app);
  const io = attachGateway(http, {
    jwtSecret: cfg.jwtSecret,
    workflows,
    ops,
    presence,
    pub,
    sub,
  });

  await new Promise<void>((resolve) => http.listen(cfg.port, resolve));
  console.log(
    `[workflow-builder] http+ws listening on :${cfg.port} (mongo=${cfg.mongoDb}, redis=${cfg.redisHost}:${cfg.redisPort})`,
  );

  const shutdown = async (sig: string): Promise<void> => {
    console.log(`[workflow-builder] received ${sig}, shutting down`);
    io.close();
    await new Promise<void>((res) => http.close(() => res()));
    await closeMongo(db);
    pub.disconnect();
    sub.disconnect();
    jobRedis.disconnect();
  };
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.on(sig, () => {
      shutdown(sig).then(() => process.exit(0)).catch(() => process.exit(1));
    });
  }
}

main().catch((err) => {
  console.error("[workflow-builder] startup failed", err);
  process.exit(1);
});
