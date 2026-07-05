import type { CircuitState, CircuitStats } from "../types.js";

interface CircuitOpts {
  errorRate: number;
  minRequests: number;
  openMs: number;
  windowMs: number;
}

interface InternalState {
  state: CircuitState;
  total: number;
  failures: number;
  windowStartedAt: number;
  openedAt?: number;
  lastError?: string;
  halfOpenInflight: boolean;
}

export class CircuitBreaker {
  private states = new Map<string, InternalState>();

  constructor(private readonly opts: CircuitOpts) {}

  private get(key: string): InternalState {
    let s = this.states.get(key);
    if (!s) {
      s = {
        state: "closed",
        total: 0,
        failures: 0,
        windowStartedAt: Date.now(),
        halfOpenInflight: false,
      };
      this.states.set(key, s);
    }
    return s;
  }

  shouldAllow(key: string): { allow: boolean; reason?: string } {
    const s = this.get(key);
    const now = Date.now();
    if (s.state === "open") {
      if (s.openedAt && now - s.openedAt >= this.opts.openMs) {
        s.state = "half_open";
        s.halfOpenInflight = false;
        return { allow: true };
      }
      return { allow: false, reason: "circuit_open" };
    }
    if (s.state === "half_open") {
      if (s.halfOpenInflight) {
        return { allow: false, reason: "circuit_probing" };
      }
      s.halfOpenInflight = true;
      return { allow: true };
    }
    return { allow: true };
  }

  recordSuccess(key: string): void {
    const s = this.get(key);
    const now = Date.now();
    if (s.state === "half_open") {
      s.state = "closed";
      s.total = 0;
      s.failures = 0;
      s.windowStartedAt = now;
      s.openedAt = undefined;
      s.halfOpenInflight = false;
      s.lastError = undefined;
      return;
    }
    if (now - s.windowStartedAt > this.opts.windowMs) {
      s.windowStartedAt = now;
      s.total = 0;
      s.failures = 0;
    }
    s.total += 1;
  }

  recordFailure(key: string, error: string): void {
    const s = this.get(key);
    const now = Date.now();
    s.lastError = error;
    if (s.state === "half_open") {
      s.state = "open";
      s.openedAt = now;
      s.halfOpenInflight = false;
      return;
    }
    if (now - s.windowStartedAt > this.opts.windowMs) {
      s.windowStartedAt = now;
      s.total = 0;
      s.failures = 0;
    }
    s.total += 1;
    s.failures += 1;
    if (s.total >= this.opts.minRequests) {
      const rate = s.failures / s.total;
      if (rate >= this.opts.errorRate) {
        s.state = "open";
        s.openedAt = now;
      }
    }
  }

  stats(): Record<string, CircuitStats> {
    const out: Record<string, CircuitStats> = {};
    for (const [k, v] of this.states) {
      const stat: CircuitStats = {
        state: v.state,
        total: v.total,
        failures: v.failures,
      };
      if (v.openedAt !== undefined) stat.openedAt = v.openedAt;
      if (v.lastError !== undefined) stat.lastError = v.lastError;
      out[k] = stat;
    }
    return out;
  }
}
