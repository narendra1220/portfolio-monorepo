import type { Redis } from "ioredis";
import { hostname } from "node:os";
import { k, DEFAULT_GROUP } from "./keys.js";
import { decodeJob, encodeJob } from "./serializer.js";
import { computeBackoffMs } from "./retry.js";
import { loadLuaScripts, type LuaScripts } from "./lua.js";
import type { JobRecord } from "./types.js";

export interface ReaperOptions {
  queue: string;
  groupName?: string;
  consumerName?: string;
  visibilityTimeoutMs?: number;
  tickMs?: number;
  batch?: number;
}

interface PendingEntry {
  entryId: string;
  consumer: string;
  idleMs: number;
  deliveryCount: number;
}

export class Reaper {
  readonly queue: string;
  readonly group: string;
  readonly consumerName: string;
  readonly visibilityTimeoutMs: number;
  readonly tickMs: number;
  readonly batch: number;

  private readonly lua: LuaScripts;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tickInFlight: Promise<void> | null = null;

  reclaimed = 0;
  killed = 0;

  constructor(
    private readonly redis: Redis,
    opts: ReaperOptions,
  ) {
    this.queue = opts.queue;
    this.group = opts.groupName ?? DEFAULT_GROUP;
    this.consumerName =
      opts.consumerName ?? `reaper-${hostname()}-${process.pid}`;
    this.visibilityTimeoutMs = opts.visibilityTimeoutMs ?? 30_000;
    this.tickMs = opts.tickMs ?? 5_000;
    this.batch = opts.batch ?? 100;
    this.lua = loadLuaScripts(redis);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    const loop = async (): Promise<void> => {
      if (!this.running) return;
      this.tickInFlight = this.tick()
        .then(() => undefined)
        .catch(() => undefined);
      await this.tickInFlight;
      if (this.running) {
        this.timer = setTimeout(loop, this.tickMs);
      }
    };
    void loop();
  }

  async tick(): Promise<{ reclaimed: number; killed: number }> {
    const pending = await this.fetchPending();
    let reclaimed = 0;
    let killed = 0;
    for (const p of pending) {
      const handled = await this.handlePending(p);
      if (handled === "reclaimed") reclaimed++;
      if (handled === "killed") killed++;
    }
    this.reclaimed += reclaimed;
    this.killed += killed;
    return { reclaimed, killed };
  }

  private async fetchPending(): Promise<PendingEntry[]> {
    const stream = k.stream(this.queue);
    const res = (await this.redis.xpending(
      stream,
      this.group,
      "IDLE",
      this.visibilityTimeoutMs,
      "-",
      "+",
      this.batch,
    )) as Array<[string, string, number, number]> | null;
    if (!res || res.length === 0) return [];
    return res.map(([entryId, consumer, idleMs, deliveryCount]) => ({
      entryId,
      consumer,
      idleMs,
      deliveryCount,
    }));
  }

  private async handlePending(
    p: PendingEntry,
  ): Promise<"reclaimed" | "killed" | "noop"> {
    const stream = k.stream(this.queue);
    const claimed = (await this.redis.xclaim(
      stream,
      this.group,
      this.consumerName,
      this.visibilityTimeoutMs,
      p.entryId,
    )) as Array<[string, string[]]> | null;
    if (!claimed || claimed.length === 0) return "noop";

    const entry = claimed[0];
    if (!entry) return "noop";
    const [entryId, fields] = entry;
    const dataIdx = fields.indexOf("data");
    const data = dataIdx >= 0 ? fields[dataIdx + 1] : undefined;
    if (!data) {
      await this.redis.xack(stream, this.group, entryId);
      await this.redis.xdel(stream, entryId);
      return "noop";
    }

    let job: JobRecord;
    try {
      job = decodeJob(data);
    } catch {
      await this.redis.xack(stream, this.group, entryId);
      await this.redis.xdel(stream, entryId);
      return "noop";
    }

    job.attempts += 1;
    const now = Date.now();
    job.updatedAt = now;
    const errMsg = `reaped: worker ${p.consumer} stalled ${p.idleMs}ms`;
    job.lastError = errMsg;

    if (job.attempts >= job.maxAttempts) {
      job.state = "dead";
      await this.lua.ackAndDead(
        stream,
        k.job(job.id),
        k.dlq(this.queue),
        this.group,
        entryId,
        job.id,
        encodeJob(job),
        now,
        errMsg,
        job.attempts,
      );
      return "killed";
    }

    const delay = computeBackoffMs(job.attempts, job.backoff);
    const runAt = now + delay;
    job.state = "delayed";
    job.scheduledFor = runAt;

    await this.redis.hset(k.job(job.id), "data", encodeJob(job));
    await this.lua.ackAndRetry(
      stream,
      k.job(job.id),
      k.delayed(this.queue),
      this.group,
      entryId,
      job.id,
      runAt,
      now,
      errMsg,
      job.attempts,
    );
    return "reclaimed";
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.tickInFlight) await this.tickInFlight.catch(() => undefined);
  }
}
