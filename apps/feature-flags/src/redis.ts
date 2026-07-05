import { Redis } from "ioredis";

export function makeRedis(host: string, port: number): Redis {
  return new Redis({
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}
