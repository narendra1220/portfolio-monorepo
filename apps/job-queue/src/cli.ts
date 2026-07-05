import { createRedis } from "./redis.js";
import { Queue } from "./queue.js";
import { DeadLetterQueue } from "./dlq.js";
import { k, DEFAULT_GROUP } from "./keys.js";

async function main(): Promise<void> {
  const [, , cmd, queueName, ...rest] = process.argv;
  if (!cmd) {
    printUsage();
    process.exit(1);
  }

  const redis = createRedis();
  try {
    switch (cmd) {
      case "stats": {
        requireQueue(queueName);
        const q = new Queue(redis, { name: queueName });
        const c = await q.counts();
        const consumers = (await redis
          .xinfo("CONSUMERS", k.stream(queueName), DEFAULT_GROUP)
          .catch(() => [])) as Array<string[]>;
        const oldestDelayed = (await redis.zrange(
          k.delayed(queueName),
          0,
          0,
          "WITHSCORES",
        )) as string[];
        console.log(JSON.stringify(
          {
            queue: queueName,
            counts: c,
            workers: consumers.map(formatConsumer),
            nextDelayedAt:
              oldestDelayed.length === 2 ? Number(oldestDelayed[1]) : null,
          },
          null,
          2,
        ));
        break;
      }
      case "dlq:list": {
        requireQueue(queueName);
        const dlq = new DeadLetterQueue(redis, queueName);
        const items = await dlq.list(Number(rest[0] ?? 20));
        console.log(JSON.stringify(items, null, 2));
        break;
      }
      case "dlq:requeue": {
        requireQueue(queueName);
        const jobId = rest[0];
        if (!jobId) {
          console.error("usage: dlq:requeue <queue> <jobId>");
          process.exit(1);
        }
        const dlq = new DeadLetterQueue(redis, queueName);
        const ok = await dlq.requeue(jobId);
        console.log(ok ? "requeued" : "not found");
        break;
      }
      case "dlq:purge": {
        requireQueue(queueName);
        const dlq = new DeadLetterQueue(redis, queueName);
        const n = await dlq.purge();
        console.log(`purged ${n}`);
        break;
      }
      case "peek": {
        requireQueue(queueName);
        const items = (await redis.xrange(
          k.stream(queueName),
          "-",
          "+",
          "COUNT",
          Number(rest[0] ?? 10),
        )) as Array<[string, string[]]>;
        console.log(JSON.stringify(items, null, 2));
        break;
      }
      case "job": {
        const jobId = queueName;
        if (!jobId) {
          console.error("usage: job <jobId>");
          process.exit(1);
        }
        const data = await redis.hgetall(k.job(jobId));
        console.log(JSON.stringify(data, null, 2));
        break;
      }
      default:
        printUsage();
        process.exit(1);
    }
  } finally {
    redis.disconnect();
  }
}

function requireQueue(name: string | undefined): asserts name is string {
  if (!name) {
    console.error("missing <queue> argument");
    process.exit(1);
  }
}

function formatConsumer(arr: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < arr.length; i += 2) {
    const k = arr[i];
    const v = arr[i + 1];
    if (k !== undefined && v !== undefined) out[k] = v;
  }
  return out;
}

function printUsage(): void {
  console.log(
    [
      "Distributed Job Queue CLI",
      "",
      "Commands:",
      "  stats <queue>                  show queue stats",
      "  peek <queue> [count]           preview waiting entries",
      "  job <jobId>                    show job record",
      "  dlq:list <queue> [count]       list dead-letter jobs",
      "  dlq:requeue <queue> <jobId>    move a dead job back to waiting",
      "  dlq:purge <queue>              wipe DLQ",
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
