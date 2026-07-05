export interface DevPortalService {
  _id: string;
  id: string;
  name: string;
  description: string;
  owner: { team: string; contact: string; slack?: string };
  tier: "tier-0" | "tier-1" | "tier-2" | "tier-3";
  lifecycle: "experimental" | "beta" | "ga" | "deprecated" | "sunset";
  baseUrl: string;
  healthUrl: string;
  openapiUrl?: string;
  tags?: string[];
  links?: { repo?: string; runbook?: string; docs?: string; dashboard?: string };
  dependencies?: string[];
  version: number;
  registeredAt: number;
  updatedAt: number;
}

export interface HealthRollup {
  checkedAt: number;
  total: number;
  summary: Record<string, number>;
  results: Array<{
    serviceId: string;
    name: string;
    url: string;
    status: "up" | "down" | "degraded" | "unknown";
    latencyMs?: number;
    error?: string;
  }>;
}

export interface PlaygroundResult {
  serviceId: string;
  request: { method: string; url: string };
  status: number;
  durationMs: number;
  headers: Record<string, string>;
  body: unknown;
}

export interface FlagVariant {
  key: string;
  value: boolean | string | number;
}

export interface TargetingRule {
  id: string;
  description?: string;
  conditions: Array<{ attr: string; op: string; value: unknown }>;
  variant: string;
}

export interface EnvironmentConfig {
  enabled: boolean;
  defaultVariant: string;
  rules: TargetingRule[];
  rollout?: { variant: string; percentage: number };
}

export interface FeatureFlag {
  _id: string;
  key: string;
  type: "boolean" | "string" | "number";
  description?: string;
  variants: FlagVariant[];
  environments: Record<string, EnvironmentConfig>;
  owner: string;
  createdAt: number;
  updatedAt: number;
}

export interface EvalResult {
  flag: string;
  value: boolean | string | number;
  variant: string;
  reason: string;
  rulesetVersion?: number;
}
