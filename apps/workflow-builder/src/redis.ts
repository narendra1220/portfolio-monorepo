import { Redis } from "ioredis";

export function createRedis(host: string, port: number): Redis {
  return new Redis({
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}
