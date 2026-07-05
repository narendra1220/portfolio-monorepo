import type { BackoffOptions } from "./types.js";

export function computeBackoffMs(
  attempt: number,
  opts: BackoffOptions,
): number {
  if (attempt < 1) attempt = 1;
  const cap = opts.maxDelayMs ?? 60_000;
  const factor = opts.factor ?? 2;
  switch (opts.kind) {
    case "fixed":
      return Math.min(opts.delayMs, cap);
    case "exponential": {
      const d = opts.delayMs * Math.pow(factor, attempt - 1);
      return Math.min(d, cap);
    }
    case "exponential-jitter": {
      const d = opts.delayMs * Math.pow(factor, attempt - 1);
      const capped = Math.min(d, cap);
      return Math.floor(Math.random() * capped);
    }
    default:
      return opts.delayMs;
  }
}

export const DEFAULT_BACKOFF: BackoffOptions = {
  kind: "exponential-jitter",
  delayMs: 500,
  maxDelayMs: 30_000,
  factor: 2,
};
