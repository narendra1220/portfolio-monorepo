import { createRedis } from "../redis.js";
import { Queue } from "../queue.js";

interface EmailPayload {
  to: string;
  subject: string;
}

async function main(): Promise<void> {
  const redis = createRedis();
  const q = new Queue(redis, {
    name: "default",
    defaultMaxAttempts: 3,
    defaultTimeoutMs: 5_000,
  });

  const n = Number(process.argv[2] ?? 10);
  console.log(`enqueueing ${n} jobs`);

  for (let i = 0; i < n; i++) {
    const payload: EmailPayload = {
      to: `user${i}@example.com`,
      subject: `hello ${i}`,
    };
    const job = await q.add<EmailPayload>(
      "send-email",
      payload,
      i % 5 === 0 ? { delayMs: 3_000 } : {},
    );
    console.log(`enqueued ${job.id} (${job.state})`);
  }

  const idem = await q.add(
    "send-email",
    { to: "dedup@example.com", subject: "once only" },
    { idempotencyKey: "welcome-dedup@example.com", idempotencyTtlMs: 60_000 },
  );
  console.log(`idempotent first call: ${idem.id}`);
  const idem2 = await q.add(
    "send-email",
    { to: "dedup@example.com", subject: "again?" },
    { idempotencyKey: "welcome-dedup@example.com", idempotencyTtlMs: 60_000 },
  );
  console.log(`idempotent second call: ${idem2.id} (should match)`);

  console.log("counts:", await q.counts());
  await redis.quit();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
