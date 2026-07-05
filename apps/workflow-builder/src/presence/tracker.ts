import type { Redis } from "ioredis";
import type { Presence } from "../types.js";

export class PresenceTracker {
  constructor(private readonly redis: Redis) {}

  private key(workflowId: string): string {
    return `wfb:presence:${workflowId}`;
  }

  async set(workflowId: string, actor: string, p: Omit<Presence, "actor" | "ts">): Promise<void> {
    const value: Presence = { actor, ...p, ts: Date.now() };
    await this.redis
      .multi()
      .hset(this.key(workflowId), actor, JSON.stringify(value))
      .pexpire(this.key(workflowId), 60_000)
      .exec();
  }

  async remove(workflowId: string, actor: string): Promise<void> {
    await this.redis.hdel(this.key(workflowId), actor);
  }

  async list(workflowId: string): Promise<Presence[]> {
    const map = await this.redis.hgetall(this.key(workflowId));
    const cutoff = Date.now() - 45_000;
    const out: Presence[] = [];
    for (const raw of Object.values(map)) {
      try {
        const p = JSON.parse(raw) as Presence;
        if (p.ts >= cutoff) out.push(p);
      } catch {
        continue;
      }
    }
    return out;
  }
}
