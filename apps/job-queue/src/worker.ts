import type { Redis } from "ioredis";
import { hostname } from "node:os";
import { k, DEFAULT_GROUP } from "./keys.js";
import { decodeJob, encodeJob } from "./serializer.js";
import { Semaphore } from "./semaphore.js";
import { computeBackoffMs } from "./retry.js";
import { loadLuaScripts, type LuaScripts } from "./lua.js";
import { Metrics } from "./metrics.js";
import { QueueEvents } from "./events.js";
import type { JobHandler, JobRecord, WorkerOptions } from "./types.js";

interface ClaimedJob {
  entryId: string;
  data: string;
}

type WorkerState = "idle" | "running" | "draining" | "stopped";

export class Worker<T = unknown, R = unknown> {
  readonly queue: string;
  readonly group: string;
  readonly consumerName: string;
  readonly concurrency: number;
  readonly blockMs: number;
  readonly batchSize: number;
  readonly visibilityTimeoutMs: number;

  readonly metrics = new Metrics();
  readonly events = new QueueEvents();

  private readonly sem: Semaphore;
  private readonly lua: LuaScripts;
  private state: WorkerState = "idle";
  private mainLoopPromise: Promise<void> | null = null;

  constructor(
    private readonly redis: Redis,
    opts: WorkerOptions,
    private readonly handler: JobHandler<T, R>,
  ) {
    this.queue = opts.queue;
    this.group = opts.groupName ?? DEFAULT_GROUP;
    this.consumerName =
      opts.consumerName ?? `${hostname()}-${process.pid}-${Date.now()}`;
    this.concurrency = opts.concurrency ?? 4;
    this.blockMs = opts.blockMs ?? 2000;
    this.batchSize = opts.batchSize ?? this.concurrency;
    this.visibilityTimeoutMs = opts.visibilityTimeoutMs ?? 30_000;
    this.sem = new Semaphore(this.concurrency);
    this.lua = loadLuaScripts(redis);
  }

  async start(): Promise<void> {
    if (this.state !== "idle") return;
    await this.ensureGroup();
    this.state = "running";
    this.mainLoopPromise = this.runLoop();
  }

  private async ensureGroup(): Promise<void> {
    try {
      await this.redis.xgroup(
        "CREATE",
        k.stream(this.queue),
        this.group,
        "0",
        "MKSTREAM",
      );
    } catch (err) {
      const msg = (err as Error).message;
      if (!msg.includes("BUSYGROUP")) throw err;
    }
  }

  private async runLoop(): Promise<void> {
    while (this.state === "running") {
      const slots = this.sem.free;
      if (slots === 0) {
        await new Promise((r) => setTimeout(r, 10));
        continue;
      }
      const want = Math.min(slots, this.batchSize);
      let claimed: ClaimedJob[] = [];
      try {
        claimed = await this.readNew(want);
      } catch (err) {
        if (this.state !== "running") break;
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      for (const c of claimed) {
        await this.sem.acquire();
        this.processOne(c).finally(() => this.sem.release());
      }
    }
  }

  private async readNew(count: number): Promise<ClaimedJob[]> {
    const res = (await this.redis.xreadgroup(
      "GROUP",
      this.group,
      this.consumerName,
      "COUNT",
      count,
      "BLOCK",
      this.blockMs,
      "STREAMS",
      k.stream(this.queue),
      ">",
    )) as Array<[string, Array<[string, string[]]>]> | null;
    if (!res || res.length === 0) return [];
    const out: ClaimedJob[] = [];
    for (const [, entries] of res) {
      for (const [entryId, fields] of entries) {
        const dataIdx = fields.indexOf("data");
        const data = dataIdx >= 0 ? fields[dataIdx + 1] : undefined;
        if (data) out.push({ entryId, data });
      }
    }
    return out;
  }

  private async processOne(c: ClaimedJob): Promise<void> {
    let job: JobRecord<T>;
    try {
      job = decodeJob<T>(c.data);
    } catch (err) {
      await this.redis.xack(k.stream(this.queue), this.group, c.entryId);
      await this.redis.xdel(k.stream(this.queue), c.entryId);
      this.metrics.inc("poison");
      return;
    }

    const startedAt = Date.now();
    job.attempts += 1;
    job.state = "active";
    job.updatedAt = startedAt;
    this.events.emitEvent({
      type: "job:active",
      jobId: job.id,
      queue: this.queue,
      at: startedAt,
      attempts: job.attempts,
    });

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), job.timeoutMs);
    let err: Error | null = null;
    try {
      await Promise.race([
        this.handler(job, ac.signal),
        new Promise((_, reject) => {
          ac.signal.addEventListener("abort", () =>
            reject(new Error(`handler timed out after ${job.timeoutMs}ms`)),
          );
        }),
      ]);
    } catch (e) {
      err = e instanceof Error ? e : new Error(String(e));
    } finally {
      clearTimeout(timer);
    }

    const finishedAt = Date.now();
    this.metrics.recordLatency(finishedAt - startedAt);

    if (!err) {
      await this.lua.ackAndComplete(
        k.stream(this.queue),
        k.job(job.id),
        this.group,
        c.entryId,
        finishedAt,
      );
      this.metrics.inc("completed");
      this.events.emitEvent({
        type: "job:completed",
        jobId: job.id,
        queue: this.queue,
        at: finishedAt,
        attempts: job.attempts,
      });
      return;
    }

    const errMsg = err.message.slice(0, 500);
    if (job.attempts >= job.maxAttempts) {
      job.state = "dead";
      job.lastError = errMsg;
      await this.lua.ackAndDead(
        k.stream(this.queue),
        k.job(job.id),
        k.dlq(this.queue),
        this.group,
        c.entryId,
        job.id,
        encodeJob(job),
        finishedAt,
        errMsg,
        job.attempts,
      );
      this.metrics.inc("dead");
      this.events.emitEvent({
        type: "job:dead",
        jobId: job.id,
        queue: this.queue,
        at: finishedAt,
        attempts: job.attempts,
        error: errMsg,
      });
      return;
    }

    const delay = computeBackoffMs(job.attempts, job.backoff);
    const runAt = finishedAt + delay;
    job.state = "delayed";
    job.lastError = errMsg;
    job.scheduledFor = runAt;
    job.updatedAt = finishedAt;

    await this.redis.hset(k.job(job.id), "data", encodeJob(job));
    await this.lua.ackAndRetry(
      k.stream(this.queue),
      k.job(job.id),
      k.delayed(this.queue),
      this.group,
      c.entryId,
      job.id,
      runAt,
      finishedAt,
      errMsg,
      job.attempts,
    );
    this.metrics.inc("retried");
    this.events.emitEvent({
      type: "job:retry",
      jobId: job.id,
      queue: this.queue,
      at: finishedAt,
      attempts: job.attempts,
      error: errMsg,
    });
  }

  async stop(drainTimeoutMs = 30_000): Promise<void> {
    if (this.state === "stopped") return;
    this.state = "draining";
    const deadline = Date.now() + drainTimeoutMs;
    while (this.sem.inUse > 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
    this.state = "stopped";
    if (this.mainLoopPromise) {
      await Promise.race([
        this.mainLoopPromise,
        new Promise((r) => setTimeout(r, 1000)),
      ]);
    }
  }

  status(): {
    state: WorkerState;
    inFlight: number;
    consumer: string;
    group: string;
  } {
    return {
      state: this.state,
      inFlight: this.sem.inUse,
      consumer: this.consumerName,
      group: this.group,
    };
  }
}
