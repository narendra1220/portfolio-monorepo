import type {
  PlaygroundRequest,
  PlaygroundResponse,
  Service,
} from "../types.js";

export interface PlaygroundProxy {
  forward: (
    svc: Service,
    req: PlaygroundRequest,
  ) => Promise<PlaygroundResponse>;
}

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
]);

const FORBIDDEN_PREFIX = ["set-cookie", "cookie"];

export function makePlaygroundProxy(
  timeoutMs: number,
  fetchImpl: typeof fetch = fetch,
): PlaygroundProxy {
  return {
    async forward(svc, req): Promise<PlaygroundResponse> {
      const base = stripTrailingSlash(svc.baseUrl);
      const path = req.path.startsWith("/") ? req.path : "/" + req.path;
      const url = new URL(base + path);
      if (req.query) {
        for (const [k, v] of Object.entries(req.query)) {
          url.searchParams.set(k, v);
        }
      }
      const headers = new Headers();
      headers.set("user-agent", "developer-portal-playground/1.0");
      headers.set("x-forwarded-by", "developer-portal");
      if (req.headers) {
        for (const [k, v] of Object.entries(req.headers)) {
          const lk = k.toLowerCase();
          if (HOP_BY_HOP.has(lk)) continue;
          if (FORBIDDEN_PREFIX.includes(lk)) continue;
          headers.set(k, v);
        }
      }
      let bodyText: string | undefined;
      if (req.body !== undefined && req.method !== "GET") {
        bodyText =
          typeof req.body === "string" ? req.body : JSON.stringify(req.body);
        if (!headers.has("content-type")) {
          headers.set("content-type", "application/json");
        }
      }
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const started = performance.now();
      try {
        const res = await fetchImpl(url.toString(), {
          method: req.method,
          headers,
          body: bodyText,
          signal: controller.signal,
        });
        const duration = performance.now() - started;
        const text = await res.text();
        const ct = res.headers.get("content-type") ?? "";
        let body: unknown;
        if (ct.includes("application/json") && text.length > 0) {
          try {
            body = JSON.parse(text);
          } catch {
            body = text;
          }
        } else {
          body = text;
        }
        const outHeaders: Record<string, string> = {};
        res.headers.forEach((v, k) => {
          if (!HOP_BY_HOP.has(k.toLowerCase())) outHeaders[k] = v;
        });
        return {
          serviceId: svc.id,
          request: { method: req.method, url: url.toString() },
          status: res.status,
          durationMs: Math.round(duration * 100) / 100,
          headers: outHeaders,
          body,
        };
      } finally {
        clearTimeout(t);
      }
    },
  };
}

function stripTrailingSlash(s: string): string {
  return s.endsWith("/") ? s.slice(0, -1) : s;
}
