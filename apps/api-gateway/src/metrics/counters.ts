export class Counters {
  private counters = new Map<string, number>();
  private hist = new Map<string, number[]>();

  inc(name: string, labels: Record<string, string> = {}, by = 1): void {
    const key = makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + by);
  }

  observe(name: string, labels: Record<string, string>, value: number): void {
    const key = makeKey(name, labels);
    let arr = this.hist.get(key);
    if (!arr) {
      arr = [];
      this.hist.set(key, arr);
    }
    arr.push(value);
    if (arr.length > 5000) arr.splice(0, arr.length - 5000);
  }

  renderPrometheus(): string {
    const lines: string[] = [];
    for (const [k, v] of this.counters) {
      lines.push(`${k} ${v}`);
    }
    for (const [k, arr] of this.hist) {
      const stats = summarize(arr);
      const base = stripQuant(k);
      lines.push(`${base}_count ${stats.count}`);
      lines.push(`${base}_sum ${stats.sum.toFixed(3)}`);
      lines.push(`${base}{quantile="0.5"} ${stats.p50.toFixed(3)}`);
      lines.push(`${base}{quantile="0.9"} ${stats.p90.toFixed(3)}`);
      lines.push(`${base}{quantile="0.99"} ${stats.p99.toFixed(3)}`);
    }
    return lines.join("\n") + "\n";
  }
}

function stripQuant(k: string): string {
  return k;
}

function makeKey(name: string, labels: Record<string, string>): string {
  const lk = Object.keys(labels);
  if (lk.length === 0) return name;
  lk.sort();
  const parts = lk.map((k) => `${k}="${escape(labels[k] ?? "")}"`);
  return `${name}{${parts.join(",")}}`;
}

function escape(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function summarize(arr: number[]): {
  count: number;
  sum: number;
  p50: number;
  p90: number;
  p99: number;
} {
  const sorted = [...arr].sort((a, b) => a - b);
  const count = sorted.length;
  let sum = 0;
  for (const n of sorted) sum += n;
  const at = (q: number) => sorted[Math.min(count - 1, Math.floor(q * count))] ?? 0;
  return { count, sum, p50: at(0.5), p90: at(0.9), p99: at(0.99) };
}
