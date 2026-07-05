import type { Redis } from "ioredis";
import { k } from "./keys.js";
import { decodeJob, encodeJob } from "./serializer.js";
import type { JobRecord } from "./types.js";

export interface DeadJobView<T = unknown> {
  entryId: string;
  job: JobRecord<T>;
  error?: string;
}

export class DeadLetterQueue {
  constructor(
    private readonly redis: Redis,
    public readonly queue: string,
  ) {}

  async size(): Promise<number> {
    return await this.redis.xlen(k.dlq(this.queue)).catch(() => 0);
  }

  async list<T = unknown>(count = 50): Promise<Array<DeadJobView<T>>> {
    const res = (await this.redis.xrevrange(
      k.dlq(this.queue),
      "+",
      "-",
      "COUNT",
      count,
    )) as Array<[string, string[]]>;
    const out: Array<DeadJobView<T>> = [];
    for (const [entryId, fields] of res) {
      const map: Record<string, string> = {};
      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const val = fields[i + 1];
        if (key !== undefined && val !== undefined) map[key] = val;
      }
      const data = map["data"];
      if (!data) continue;
      try {
        out.push({
          entryId,
          job: decodeJob<T>(data),
          error: map["error"],
        });
      } catch {
        continue;
      }
    }
    return out;
  }

  async requeue(jobId: string): Promise<boolean> {
    const data = await this.redis.hget(k.job(jobId), "data");
    if (!data) return false;
    const job = decodeJob(data);
    job.attempts = 0;
    job.state = "waiting";
    job.updatedAt = Date.now();
    delete job.lastError;
    delete job.scheduledFor;
    const fresh = encodeJob(job);
    const tx = this.redis.multi();
    tx.hset(k.job(job.id), {
      state: "waiting",
      attempts: "0",
      updatedAt: String(job.updatedAt),
      data: fresh,
    });
    tx.xadd(k.stream(this.queue), "*", "id", job.id, "data", fresh);
    await tx.exec();
    return true;
  }

  async purge(): Promise<number> {
    const size = await this.size();
    if (size === 0) return 0;
    await this.redis.del(k.dlq(this.queue));
    return size;
  }

  async remove(entryId: string): Promise<boolean> {
    const n = await this.redis.xdel(k.dlq(this.queue), entryId);
    return n > 0;
  }
}
