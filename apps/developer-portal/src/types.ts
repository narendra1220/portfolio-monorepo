export type Tier = "tier-0" | "tier-1" | "tier-2" | "tier-3";
export type Lifecycle = "experimental" | "beta" | "ga" | "deprecated" | "sunset";

export interface ServiceOwner {
  team: string;
  contact: string;
  slack?: string;
}

export interface ServiceLinks {
  repo?: string;
  runbook?: string;
  docs?: string;
  dashboard?: string;
}

export interface ServiceManifest {
  id: string;
  name: string;
  description: string;
  owner: ServiceOwner;
  tier: Tier;
  lifecycle: Lifecycle;
  baseUrl: string;
  healthUrl: string;
  openapiUrl?: string;
  tags?: string[];
  links?: ServiceLinks;
  dependencies?: string[];
}

export interface Service extends ServiceManifest {
  _id: string;
  version: number;
  registeredAt: number;
  updatedAt: number;
}

export interface ServiceVersionDoc {
  _id: string;
  serviceId: string;
  version: number;
  manifest: ServiceManifest;
  changedBy: string;
  ts: number;
}

export interface HealthResult {
  serviceId: string;
  name: string;
  url: string;
  status: "up" | "down" | "degraded" | "unknown";
  latencyMs?: number;
  statusCode?: number;
  error?: string;
  checkedAt: number;
}

export interface PlaygroundRequest {
  serviceId: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface PlaygroundResponse {
  serviceId: string;
  request: { method: string; url: string };
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: unknown;
}
