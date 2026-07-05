import { Redis, type RedisOptions } from "ioredis";

export interface RedisConfig {
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

export function createRedis(cfg: RedisConfig = {}): Redis {
  const opts: RedisOptions = {
    host: cfg.host ?? process.env.REDIS_HOST ?? "127.0.0.1",
    port: cfg.port ?? Number(process.env.REDIS_PORT ?? 6379),
    db: cfg.db ?? Number(process.env.REDIS_DB ?? 0),
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
    retryStrategy(times) {
      return Math.min(50 * 2 ** Math.min(times, 8), 5000);
    },
    reconnectOnError(err) {
      const target = "READONLY";
      return err.message.includes(target);
    },
  };
  if (cfg.password ?? process.env.REDIS_PASSWORD) {
    opts.password = cfg.password ?? process.env.REDIS_PASSWORD;
  }
  if (cfg.keyPrefix) opts.keyPrefix = cfg.keyPrefix;
  return new Redis(opts);
}

export async function healthcheck(r: Redis): Promise<boolean> {
  try {
    const pong = await r.ping();
    return pong === "PONG";
  } catch {
    return false;
  }
}
