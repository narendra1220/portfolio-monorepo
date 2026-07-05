import { loadConfig } from "../config.js";
import { connectMongo, closeMongo } from "../mongo.js";
import { WorkflowRepo } from "../repo/workflows.js";
import { RunRepo } from "../repo/runs.js";
import { executeWorkflow } from "../execution/engine.js";
import {
  Worker,
  Scheduler,
  Reaper,
  createRedis as createJobQueueRedis,
  installGracefulShutdown,
} from "@portfolio/job-queue";

interface RunJob {
  runId: string;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const db = await connectMongo(cfg.mongoUri, cfg.mongoDb);
  const redis = createJobQueueRedis({ host: cfg.redisHost, port: cfg.redisPort });

  const workflows = new WorkflowRepo(db);
  const runs = new RunRepo(db);

  const worker = new Worker<RunJob, void>(
    redis,
    {
      queue: cfg.queueName,
      concurrency: 4,
      blockMs: 1500,
      visibilityTimeoutMs: 120_000,
    },
    async (job) => {
      const run = await runs.get(job.payload.runId);
      if (!run) {
        console.warn(`[runner] run ${job.payload.runId} not found, skipping`);
        return;
      }
      const wf = await workflows.get(run.workflowId);
      if (!wf) {
        await runs.setStatus(run._id, "failed", {
          error: "workflow deleted",
          endedAt: Date.now(),
        });
        return;
      }
      const hydrated = await workflows.hydrate(wf._id);
      const doc = hydrated?.doc ?? wf.snapshot;

      const result = await executeWorkflow(wf, doc, run, runs);
      await runs.setStatus(run._id, result.status, {
        endedAt: Date.now(),
        output: result.output,
        ...(result.error ? { error: result.error } : {}),
      });
      console.log(
        `[runner] run ${run._id} → ${result.status}${result.error ? " :: " + result.error : ""}`,
      );
    },
  );

  worker.events.on("job:dead", (ev) =>
    console.error(`[runner] DEAD ${ev.jobId}: ${ev.error}`),
  );

  const scheduler = new Scheduler(redis, { queue: cfg.queueName, tickMs: 500 });
  const reaper = new Reaper(redis, {
    queue: cfg.queueName,
    visibilityTimeoutMs: 120_000,
    tickMs: 10_000,
  });

  await worker.start();
  scheduler.start();
  reaper.start();
  console.log(`[runner] consuming queue '${cfg.queueName}' as ${worker.consumerName}`);

  installGracefulShutdown({
    workers: [worker],
    schedulers: [scheduler],
    reapers: [reaper],
    redis: [redis],
    drainTimeoutMs: 30_000,
  });

  const stopMongo = async (): Promise<void> => closeMongo(db);
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => {
      stopMongo().catch(() => undefined);
    });
  }
}

main().catch((err) => {
  console.error("[runner] startup failed", err);
  process.exit(1);
});
