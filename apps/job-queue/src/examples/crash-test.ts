import { createRedis } from "../redis.js";
import { Queue } from "../queue.js";
import { Worker } from "../worker.js";
import { Reaper } from "../reaper.js";
import { Scheduler } from "../scheduler.js";

async function main(): Promise<void> {
  const redis = createRedis();
  const queue = "crash-test";

  await redis.del(`jq:stream:${queue}`);
  await redis.del(`jq:dlq:${queue}`);
  await redis.del(`jq:delayed:${queue}`);

  const q = new Queue(redis, { name: queue, defaultMaxAttempts: 3 });
  const job = await q.add(
    "long-task",
    { id: "victim" },
    { timeoutMs: 60_000, maxAttempts: 3 },
  );
  console.log(`enqueued victim job ${job.id}`);

  const dyingWorker = new Worker(
    redis,
    {
      queue,
      concurrency: 1,
      blockMs: 500,
      visibilityTimeoutMs: 3_000,
      consumerName: "dying-worker",
    },
    async () => {
      console.log("dying worker grabbed job, will never ack");
      await new Promise(() => undefined);
    },
  );
  await dyingWorker.start();

  await new Promise((r) => setTimeout(r, 1000));
  console.log("simulating crash: stopping fetch loop without acking");
  (dyingWorker as unknown as { state: string }).state = "stopped";

  const reaper = new Reaper(redis, {
    queue,
    visibilityTimeoutMs: 3_000,
    tickMs: 1_000,
  });
  reaper.start();

  const scheduler = new Scheduler(redis, { queue, tickMs: 200 });
  scheduler.start();

  const survivor = new Worker(
    redis,
    {
      queue,
      concurrency: 1,
      blockMs: 500,
      visibilityTimeoutMs: 3_000,
      consumerName: "survivor",
    },
    async (j) => {
      console.log(`[survivor] picked up ${j.id} attempt=${j.attempts}`);
    },
  );
  await survivor.start();

  await new Promise((r) => setTimeout(r, 15_000));
  console.log("reaper stats:", { reclaimed: reaper.reclaimed, killed: reaper.killed });
  console.log("survivor metrics:", survivor.metrics.snapshot());

  await reaper.stop();
  await scheduler.stop();
  await survivor.stop(5_000);
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
