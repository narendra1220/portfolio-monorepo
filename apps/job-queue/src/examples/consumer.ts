import { createRedis } from "../redis.js";
import { Worker } from "../worker.js";
import { Scheduler } from "../scheduler.js";
import { Reaper } from "../reaper.js";
import { installGracefulShutdown } from "../lifecycle.js";

interface EmailPayload {
  to: string;
  subject: string;
}

async function main(): Promise<void> {
  const redis = createRedis();
  const queue = "default";

  const worker = new Worker<EmailPayload, void>(
    redis,
    {
      queue,
      concurrency: 4,
      blockMs: 1500,
      visibilityTimeoutMs: 10_000,
    },
    async (job, signal) => {
      const ms = 200 + Math.floor(Math.random() * 600);
      await new Promise((res, rej) => {
        const t = setTimeout(res, ms);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          rej(new Error("aborted"));
        });
      });
      if (job.payload.to.includes("user3@")) {
        throw new Error("simulated failure for user3");
      }
      console.log(`[done] ${job.id} -> ${job.payload.to}`);
    },
  );

  worker.events.on("job:retry", (ev) =>
    console.log(`[retry] ${ev.jobId} attempt ${ev.attempts}: ${ev.error}`),
  );
  worker.events.on("job:dead", (ev) =>
    console.log(`[dead]  ${ev.jobId}: ${ev.error}`),
  );

  const scheduler = new Scheduler(redis, { queue, tickMs: 500 });
  const reaper = new Reaper(redis, {
    queue,
    visibilityTimeoutMs: 10_000,
    tickMs: 3_000,
  });

  await worker.start();
  scheduler.start();
  reaper.start();
  console.log(`worker ${worker.consumerName} running on queue '${queue}'`);

  installGracefulShutdown({
    workers: [worker],
    schedulers: [scheduler],
    reapers: [reaper],
    redis: [redis],
    drainTimeoutMs: 10_000,
  });

  setInterval(() => {
    const s = worker.metrics.snapshot();
    console.log(
      `[metrics] ${JSON.stringify(s.counters)} latency p50=${s.latency.p50}ms p95=${s.latency.p95}ms`,
    );
  }, 5_000).unref();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
