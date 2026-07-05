import type { Redis } from "ioredis";
import {
  RULESET_CHANNEL,
  RULESET_LATEST_KEY,
  RULESET_REDIS_KEY,
} from "../config.js";
import type { Ruleset } from "../types.js";

export class RulesetPublisher {
  constructor(private readonly redis: Redis) {}

  async publish(ruleset: Ruleset): Promise<void> {
    const payload = JSON.stringify(ruleset);
    const versionedKey = RULESET_REDIS_KEY(ruleset.env, ruleset.version);
    const latestKey = RULESET_LATEST_KEY(ruleset.env);
    await this.redis
      .multi()
      .set(versionedKey, payload, "EX", 24 * 60 * 60)
      .set(latestKey, String(ruleset.version))
      .exec();
    await this.redis.publish(
      RULESET_CHANNEL,
      JSON.stringify({ env: ruleset.env, version: ruleset.version }),
    );
  }

  async fetch(env: string, version: number): Promise<Ruleset | null> {
    const payload = await this.redis.get(RULESET_REDIS_KEY(env, version));
    return payload ? (JSON.parse(payload) as Ruleset) : null;
  }

  async fetchLatest(env: string): Promise<Ruleset | null> {
    const v = await this.redis.get(RULESET_LATEST_KEY(env));
    if (!v) return null;
    return this.fetch(env, Number(v));
  }
}
