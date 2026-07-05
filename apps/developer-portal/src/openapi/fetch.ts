import type { Redis } from "ioredis";
import { OPENAPI_CACHE_KEY } from "../config.js";

export interface FetchedOpenAPI {
  serviceId: string;
  url: string;
  fetchedAt: number;
  source: "cache" | "origin";
  doc: unknown;
}

export interface OpenAPIFetcher {
  fetch: (serviceId: string, url: string) => Promise<FetchedOpenAPI>;
  invalidate: (serviceId: string) => Promise<void>;
}

export function makeOpenAPIFetcher(
  redis: Redis,
  ttlSeconds: number,
  fetchImpl: typeof fetch = fetch,
): OpenAPIFetcher {
  return {
    async fetch(serviceId, url): Promise<FetchedOpenAPI> {
      const key = OPENAPI_CACHE_KEY(serviceId);
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as Omit<FetchedOpenAPI, "source">;
        return { ...parsed, source: "cache" };
      }
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 4000);
      let res;
      try {
        res = await fetchImpl(url, { signal: controller.signal });
      } finally {
        clearTimeout(t);
      }
      if (!res.ok) throw new Error(`openapi fetch ${res.status}`);
      const text = await res.text();
      const doc = text.startsWith("{") || text.startsWith("[")
        ? JSON.parse(text)
        : { yaml: text };
      const fresh: FetchedOpenAPI = {
        serviceId,
        url,
        fetchedAt: Date.now(),
        source: "origin",
        doc,
      };
      const payload = JSON.stringify({
        serviceId,
        url,
        fetchedAt: fresh.fetchedAt,
        doc,
      });
      await redis.set(key, payload, "EX", ttlSeconds);
      return fresh;
    },
    async invalidate(serviceId) {
      await redis.del(OPENAPI_CACHE_KEY(serviceId));
    },
  };
}
