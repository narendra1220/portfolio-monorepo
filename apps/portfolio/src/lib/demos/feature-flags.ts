import { getDemoToken } from "./auth";
import type { EnvironmentConfig, EvalResult, FeatureFlag } from "./types";

const BASE = "/api/demos/flags";

async function api<T>(
  path: string,
  init: RequestInit = {},
  role: "admin" | "editor" | "viewer" = "viewer",
): Promise<T> {
  const token = await getDemoToken("flags", role);
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${text}`);
  }
  return text ? (JSON.parse(text) as T) : (null as T);
}

export async function checkFlagsHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listFlags(): Promise<FeatureFlag[]> {
  return api("/flags");
}

export async function getFlag(key: string): Promise<FeatureFlag> {
  return api(`/flags/${encodeURIComponent(key)}`);
}

export async function createFlag(flag: Record<string, unknown>): Promise<unknown> {
  return api("/flags", { method: "POST", body: JSON.stringify(flag) }, "editor");
}

export async function patchFlagEnv(
  key: string,
  env: string,
  patch: Partial<EnvironmentConfig>,
): Promise<{ flag: FeatureFlag }> {
  return api(
    `/flags/${encodeURIComponent(key)}/env/${encodeURIComponent(env)}`,
    { method: "PATCH", body: JSON.stringify(patch) },
    "editor",
  );
}

export async function deleteFlag(key: string): Promise<void> {
  await api(`/flags/${encodeURIComponent(key)}`, { method: "DELETE" }, "editor");
}

export async function evalFlag(body: {
  flag: string;
  env: string;
  context: { userId?: string; attrs?: Record<string, unknown> };
}): Promise<EvalResult> {
  return api("/eval", { method: "POST", body: JSON.stringify(body) });
}

export async function getLatestRulesetVersion(env: string): Promise<number | null> {
  try {
    const res = await fetch(`${BASE}/ruleset/${encodeURIComponent(env)}/latest`);
    if (!res.ok) return null;
    const data = (await res.json()) as { version: number };
    return data.version;
  } catch {
    return null;
  }
}

export function subscribeRulesetSse(
  env: string,
  onVersion: (version: number) => void,
  onError: (err: Error) => void,
): () => void {
  let closed = false;
  let controller: AbortController | null = null;

  const connect = async () => {
    while (!closed) {
      controller = new AbortController();
      try {
        const res = await fetch(`${BASE}/sse/${encodeURIComponent(env)}`, {
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx = buf.indexOf("\n\n");
          while (idx >= 0) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            for (const line of chunk.split("\n")) {
              if (line.startsWith("data: ")) {
                try {
                  const evt = JSON.parse(line.slice(6)) as { version: number };
                  if (evt.version) onVersion(evt.version);
                } catch {}
              }
            }
            idx = buf.indexOf("\n\n");
          }
        }
      } catch (e) {
        if (closed) return;
        onError(e as Error);
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  };

  void connect();
  return () => {
    closed = true;
    controller?.abort();
  };
}
