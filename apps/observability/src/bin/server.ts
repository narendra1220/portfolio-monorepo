import http from "node:http";
import { loadConfig } from "../config.js";
import { TraceBuffer } from "../ingest/buffer.js";
import { connectMongo } from "../mongo.js";
import { FlushWorker } from "../sampling/worker.js";
import { ServiceMapStore } from "../storage/services.js";
import { TraceStore } from "../storage/spans.js";
import { buildApp } from "../rest/app.js";
import type { IngestStats } from "../types.js";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const mongo = await connectMongo(cfg.mongoUri, cfg.mongoDb);

  const buffer = new TraceBuffer();
  const traceStore = new TraceStore(mongo);
  const serviceStore = new ServiceMapStore(mongo);
  const stats: IngestStats = {
    spansReceived: 0,
    logsReceived: 0,
    tracesBuffered: 0,
    tracesFlushed: 0,
    tracesDropped: 0,
    byReason: {
      error: 0,
      slow: 0,
      probabilistic: 0,
      explicit_keep: 0,
      dropped: 0,
    },
  };

  const flusher = new FlushWorker(
    buffer,
    traceStore,
    serviceStore,
    { slowTraceMs: cfg.slowTraceMs, sampleRate: cfg.sampleRate },
    cfg.bufferHoldMs,
    stats,
  );
  flusher.start(cfg.flushIntervalMs);

  const app = buildApp({ buffer, traceStore, serviceStore, mongo, stats });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(cfg.port, resolve));
  console.log(
    JSON.stringify({
      msg: "observability up",
      port: cfg.port,
      bufferHoldMs: cfg.bufferHoldMs,
      slowTraceMs: cfg.slowTraceMs,
      sampleRate: cfg.sampleRate,
    }),
  );

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ msg: "shutting down", signal }));
    flusher.stop();
    await flusher.flushAll();
    server.close();
    await mongo.client.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
