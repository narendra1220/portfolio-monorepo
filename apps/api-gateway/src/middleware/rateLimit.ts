import type { Redis } from "ioredis";
import { KEY_RL } from "../config.js";
import type { RateLimit } from "../types.js";

const SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]
redis.call('ZREMRANGEBYSCORE', key, 0, now - windowMs)
local count = tonumber(redis.call('ZCARD', key))
if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retry = 0
  if oldest[2] ~= nil then
    retry = windowMs - (now - tonumber(oldest[2]))
    if retry < 1 then retry = 1 end
  else
    retry = windowMs
  end
  return {1, count, max, retry}
end
redis.call('ZADD', key, now, member)
redis.call('PEXPIRE', key, windowMs * 2)
return {0, count + 1, max, 0}
`;

export interface RateLimitResult {
  limited: boolean;
  remaining: number;
  limit: number;
  retryAfterMs: number;
}

export class RateLimiter {
  private sha: string | null = null;
  constructor(private readonly redis: Redis) {}

  async load(): Promise<void> {
    this.sha = await this.redis.script("LOAD", SCRIPT) as string;
  }

  async check(
    consumer: string,
    routeId: string,
    cfg: RateLimit,
  ): Promise<RateLimitResult> {
    if (!this.sha) await this.load();
    const key = KEY_RL(consumer, routeId);
    const now = Date.now();
    const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    const evalSha = this.sha as string;
    let raw;
    try {
      raw = (await this.redis.evalsha(
        evalSha,
        1,
        key,
        now.toString(),
        cfg.windowMs.toString(),
        cfg.max.toString(),
        member,
      )) as [number, number, number, number];
    } catch (e) {
      if ((e as Error).message.includes("NOSCRIPT")) {
        await this.load();
        raw = (await this.redis.evalsha(
          this.sha as string,
          1,
          key,
          now.toString(),
          cfg.windowMs.toString(),
          cfg.max.toString(),
          member,
        )) as [number, number, number, number];
      } else {
        throw e;
      }
    }
    const [limited, count, max, retry] = raw;
    return {
      limited: limited === 1,
      remaining: Math.max(0, max - count),
      limit: max,
      retryAfterMs: retry,
    };
  }
}
