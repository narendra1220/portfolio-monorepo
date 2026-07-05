import { getDemoToken } from "./auth";
import type {
  DevPortalService,
  HealthRollup,
  PlaygroundResult,
} from "./types";

const BASE = "/api/demos/devportal";

async function api<T>(
  path: string,
  init: RequestInit = {},
  role: "admin" | "editor" | "viewer" = "viewer",
): Promise<T> {
  const token = await getDemoToken("devportal", role);
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

export async function checkDevPortalHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listServices(opts?: {
  q?: string;
  tier?: string;
  lifecycle?: string;
}): Promise<{ count: number; items: DevPortalService[] }> {
  const params = new URLSearchParams();
  if (opts?.q) params.set("q", opts.q);
  if (opts?.tier) params.set("tier", opts.tier);
  if (opts?.lifecycle) params.set("lifecycle", opts.lifecycle);
  const qs = params.toString();
  return api(`/services${qs ? `?${qs}` : ""}`);
}

export async function getService(id: string): Promise<DevPortalService> {
  return api(`/services/${encodeURIComponent(id)}`);
}

export async function registerManifest(
  manifest: Record<string, unknown>,
): Promise<unknown> {
  return api("/manifests", { method: "POST", body: JSON.stringify(manifest) }, "editor");
}

export async function deleteService(id: string): Promise<void> {
  await api(`/services/${encodeURIComponent(id)}`, { method: "DELETE" }, "editor");
}

export async function getHealthRollup(): Promise<HealthRollup> {
  return api("/health-rollup");
}

export async function getOpenAPI(id: string): Promise<{
  source: string;
  doc: unknown;
  fetchedAt: number;
}> {
  return api(`/services/${encodeURIComponent(id)}/openapi`);
}

export async function runPlayground(
  id: string,
  body: {
    method: string;
    path: string;
    query?: Record<string, string>;
    headers?: Record<string, string>;
    body?: unknown;
  },
): Promise<PlaygroundResult> {
  return api(
    `/services/${encodeURIComponent(id)}/playground`,
    { method: "POST", body: JSON.stringify(body) },
    "editor",
  );
}

export async function listVersions(id: string): Promise<{
  count: number;
  items: Array<{ version: number; ts: number; changedBy: string; manifest: unknown }>;
}> {
  return api(`/services/${encodeURIComponent(id)}/versions`);
}
