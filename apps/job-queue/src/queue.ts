import type { Redis } from "ioredis";
import { k } from "./keys.js";
import { newJobId } from "./ulid-id.js";
import { encodeJob } from "./serializer.js";
import { reserveIdempotency } from "./idempotency.js";
import { DEFAULT_BACKOFF } from "./retry.js";
import type {
  JobOptions,
  JobRecord,
  QueueOptions,
  BackoffOptions,
} from "./types.js";

export interface AddJobInput<T = unknown> {
  name: string;
  payload: T;
  opts?: JobOptions;
}

export class Queue {
  readonly name: string;
  private readonly defaultMaxAttempts: number;
  private readonly defaultTimeoutMs: number;
  private readonly defaultBackoff: BackoffOptions;

  constructor(
    private readonly redis: Redis,
    opts: QueueOptions,
  ) {
    this.name = opts.name;
    this.defaultMaxAttempts = opts.defaultMaxAttempts ?? 5;
    this.defaultTimeoutMs = opts.defaultTimeoutMs ?? 30_000;
    this.defaultBackoff = opts.defaultBackoff ?? DEFAULT_BACKOFF;
  }

  async add<T = unknown>(
    name: string,
    payload: T,
    opts: JobOptions = {},
  ): Promise<JobRecord<T>> {
    const now = Date.now();
    const desiredId = opts.jobId ?? newJobId();

    if (opts.idempotencyKey) {
      const ttl = opts.idempotencyTtlMs ?? 24 * 60 * 60 * 1000;
      const existing = await reserveIdempotency(
        this.redis,
        this.name,
        opts.idempotencyKey,
        desiredId,
        ttl,
      );
      if (existing) {
        const rec = await this.get<T>(existing);
        if (rec) return rec;
      }
    }

    const record: JobRecord<T> = {
      id: desiredId,
      name,
      queue: this.name,
      payload,
      attempts: 0,
      maxAttempts: opts.maxAttempts ?? this.defaultMaxAttempts,
      timeoutMs: opts.timeoutMs ?? this.defaultTimeoutMs,
      backoff: opts.backoff ?? this.defaultBackoff,
      createdAt: now,
      updatedAt: now,
      state: opts.delayMs && opts.delayMs > 0 ? "delayed" : "waiting",
    };
    if (opts.delayMs && opts.delayMs > 0) {
      record.scheduledFor = now + opts.delayMs;
    }

    const data = encodeJob(record);
    const jobKey = k.job(record.id);

    const tx = this.redis.multi();
    tx.hset(jobKey, {
      id: record.id,
      name: record.name,
      queue: record.queue,
      state: record.state,
      attempts: String(record.attempts),
      maxAttempts: String(record.maxAttempts),
      createdAt: String(record.createdAt),
      updatedAt: String(record.updatedAt),
      data,
      ...(record.scheduledFor
        ? { scheduledFor: String(record.scheduledFor) }
        : {}),
    });
    tx.expire(jobKey, 7 * 24 * 60 * 60);

    if (record.scheduledFor) {
      tx.zadd(k.delayed(this.name), record.scheduledFor, record.id);
    } else {
      tx.xadd(k.stream(this.name), "*", "id", record.id, "data", data);
    }
    await tx.exec();

    return record;
  }

  async addBulk<T = unknown>(
    jobs: Array<AddJobInput<T>>,
  ): Promise<Array<JobRecord<T>>> {
    const out: Array<JobRecord<T>> = [];
    for (const j of jobs) {
      out.push(await this.add(j.name, j.payload, j.opts));
    }
    return out;
  }

  async get<T = unknown>(jobId: string): Promise<JobRecord<T> | null> {
    const data = await this.redis.hget(k.job(jobId), "data");
    if (!data) return null;
    const { decodeJob } = await import("./serializer.js");
    return decodeJob<T>(data);
  }

  async counts(): Promise<{
    waiting: number;
    delayed: number;
    dlq: number;
    pending: number;
  }> {
    const stream = k.stream(this.name);
    const [streamLen, delayedLen, dlqLen] = await Promise.all([
      this.redis.xlen(stream).catch(() => 0),
      this.redis.zcard(k.delayed(this.name)),
      this.redis.xlen(k.dlq(this.name)).catch(() => 0),
    ]);
    let pending = 0;
    try {
      const xp = (await this.redis.xpending(stream, "workers")) as
        | [number, string, string, Array<[string, number]>]
        | null;
      if (xp && typeof xp[0] === "number") pending = xp[0];
    } catch {
      pending = 0;
    }
    return {
      waiting: streamLen,
      delayed: delayedLen,
      dlq: dlqLen,
      pending,
    };
  }
}
