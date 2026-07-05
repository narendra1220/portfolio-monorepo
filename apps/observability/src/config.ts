export interface Config {
  port: number;
  mongoUri: string;
  mongoDb: string;
  bufferHoldMs: number;
  flushIntervalMs: number;
  slowTraceMs: number;
  sampleRate: number;
}

export function loadConfig(): Config {
  return {
    port: Number(process.env.PORT ?? 4800),
    mongoUri: process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017",
    mongoDb: process.env.MONGO_DB ?? "observability",
    bufferHoldMs: Number(process.env.BUFFER_HOLD_MS ?? 3000),
    flushIntervalMs: Number(process.env.FLUSH_INTERVAL_MS ?? 1000),
    slowTraceMs: Number(process.env.SLOW_TRACE_MS ?? 500),
    sampleRate: Number(process.env.SAMPLE_RATE ?? 0.1),
  };
}
