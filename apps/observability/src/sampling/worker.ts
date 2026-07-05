import type { TraceBuffer } from "../ingest/buffer.js";
import type { TraceStore } from "../storage/spans.js";
import type { ServiceMapStore } from "../storage/services.js";
import { decide, type SamplingPolicy } from "./tail.js";
import type { IngestStats, SamplingReason } from "../types.js";

export class FlushWorker {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly buffer: TraceBuffer,
    private readonly traceStore: TraceStore,
    private readonly serviceStore: ServiceMapStore,
    private readonly policy: SamplingPolicy,
    private readonly holdMs: number,
    private readonly stats: IngestStats,
  ) {}

  start(intervalMs: number): void {
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async flushAll(): Promise<void> {
    const traces = this.buffer.drainAll();
    for (const t of traces) await this.processOne(t.spans);
  }

  private async tick(): Promise<void> {
    const ready = this.buffer.drainIdle(this.holdMs);
    this.stats.tracesBuffered = this.buffer.size();
    for (const t of ready) {
      await this.processOne(t.spans);
    }
  }

  private async processOne(spans: import("../types.js").SpanDoc[]): Promise<void> {
    const decision = decide(spans, this.policy);
    if (!decision.keep || !decision.trace) {
      this.stats.tracesDropped += 1;
      this.stats.byReason.dropped += 1;
      return;
    }
    await this.traceStore.writeTrace(decision.trace, spans);
    await this.serviceStore.materialize(decision.trace, spans);
    this.stats.tracesFlushed += 1;
    this.stats.byReason[decision.reason as SamplingReason] += 1;
  }
}
