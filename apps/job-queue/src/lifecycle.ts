import type { Redis } from "ioredis";
import type { Worker } from "./worker.js";
import type { Scheduler } from "./scheduler.js";
import type { Reaper } from "./reaper.js";

export interface ShutdownHandles {
  workers?: Array<Worker<any, any>>;
  schedulers?: Scheduler[];
  reapers?: Reaper[];
  redis?: Redis[];
  drainTimeoutMs?: number;
}

let installed = false;

export function installGracefulShutdown(h: ShutdownHandles): () => Promise<void> {
  const shutdown = async (signal?: string): Promise<void> => {
    if (signal) console.log(`[lifecycle] received ${signal}, draining`);
    const drainMs = h.drainTimeoutMs ?? 30_000;
    await Promise.all([
      ...(h.workers?.map((w) => w.stop(drainMs)) ?? []),
      ...(h.schedulers?.map((s) => s.stop()) ?? []),
      ...(h.reapers?.map((r) => r.stop()) ?? []),
    ]);
    for (const r of h.redis ?? []) {
      try {
        await r.quit();
      } catch {
        r.disconnect();
      }
    }
  };

  if (!installed) {
    installed = true;
    for (const sig of ["SIGINT", "SIGTERM"] as const) {
      process.on(sig, () => {
        shutdown(sig)
          .then(() => process.exit(0))
          .catch((err) => {
            console.error("[lifecycle] shutdown failed", err);
            process.exit(1);
          });
      });
    }
  }
  return () => shutdown();
}
