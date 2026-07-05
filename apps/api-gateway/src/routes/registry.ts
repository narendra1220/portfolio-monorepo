import type { Redis } from "ioredis";
import { CHANNEL_ROUTES, KEY_ROUTES } from "../config.js";
import type { RouteCfg } from "../types.js";

export class RouteRegistry {
  private routes = new Map<string, RouteCfg>();
  private subscriber: Redis | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly subscriberFactory: () => Redis,
  ) {}

  async loadAll(): Promise<void> {
    const docs = await this.redis.hvals(KEY_ROUTES);
    this.routes.clear();
    for (const d of docs) {
      try {
        const r = JSON.parse(d) as RouteCfg;
        this.routes.set(r.id, r);
      } catch {}
    }
  }

  async watch(): Promise<void> {
    this.subscriber = this.subscriberFactory();
    await this.subscriber.subscribe(CHANNEL_ROUTES);
    this.subscriber.on("message", (_ch: string, _msg: string) => {
      void this.loadAll();
    });
  }

  async upsert(route: RouteCfg): Promise<void> {
    await this.redis.hset(KEY_ROUTES, route.id, JSON.stringify(route));
    await this.redis.publish(CHANNEL_ROUTES, "upsert");
    this.routes.set(route.id, route);
  }

  async remove(id: string): Promise<boolean> {
    const n = await this.redis.hdel(KEY_ROUTES, id);
    if (n > 0) {
      await this.redis.publish(CHANNEL_ROUTES, "remove");
      this.routes.delete(id);
      return true;
    }
    return false;
  }

  list(): RouteCfg[] {
    return [...this.routes.values()];
  }

  shutdown(): void {
    this.subscriber?.disconnect();
  }
}
