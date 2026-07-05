export class Metrics {
  private counters = new Map<string, number>();
  private latencies: number[] = [];
  private readonly latencyCap = 10_000;

  inc(name: string, by = 1): void {
    this.counters.set(name, (this.counters.get(name) ?? 0) + by);
  }

  recordLatency(ms: number): void {
    this.latencies.push(ms);
    if (this.latencies.length > this.latencyCap) {
      this.latencies.splice(0, this.latencies.length - this.latencyCap);
    }
  }

  snapshot(): {
    counters: Record<string, number>;
    latency: { count: number; p50: number; p95: number; p99: number };
  } {
    const counters: Record<string, number> = {};
    for (const [k, v] of this.counters) counters[k] = v;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const pick = (p: number): number => {
      if (sorted.length === 0) return 0;
      const idx = Math.min(
        sorted.length - 1,
        Math.floor((p / 100) * sorted.length),
      );
      return sorted[idx] ?? 0;
    };
    return {
      counters,
      latency: {
        count: sorted.length,
        p50: pick(50),
        p95: pick(95),
        p99: pick(99),
      },
    };
  }
}
