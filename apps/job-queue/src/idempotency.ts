import type { Redis } from "ioredis";
import { k } from "./keys.js";

export async function reserveIdempotency(
  redis: Redis,
  queue: string,
  key: string,
  jobId: string,
  ttlMs: number,
): Promise<string | null> {
  const fullKey = k.idem(queue, key);
  const ok = await redis.set(fullKey, jobId, "PX", ttlMs, "NX");
  if (ok === "OK") return null;
  const existing = await redis.get(fullKey);
  return existing;
}

export async function releaseIdempotency(
  redis: Redis,
  queue: string,
  key: string,
): Promise<void> {
  await redis.del(k.idem(queue, key));
}
