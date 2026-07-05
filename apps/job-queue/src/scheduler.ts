import type { Redis } from "ioredis";
import { k } from "./keys.js";
import { loadLuaScripts, type LuaScripts } from "./lua.js";

export interface SchedulerOptions {
  queue: string;
  tickMs?: number;
  batch?: number;
}

export class Scheduler {
  readonly queue: string;
  readonly tickMs: number;
  readonly batch: number;
  private readonly lua: LuaScripts;
  private timer: NodeJS.Timeout | null = null;
  private running = false;
  private tickInFlight: Promise<void> | null = null;

  constructor(
    private readonly redis: Redis,
    opts: SchedulerOptions,
  ) {
    this.queue = opts.queue;
    this.tickMs = opts.tickMs ?? 500;
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

  async tick(): Promise<number> {
    const moved = await this.lua.atomicMoveDelayed(
      k.delayed(this.queue),
      k.stream(this.queue),
      Date.now(),
      this.batch,
    );
    return moved;
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
