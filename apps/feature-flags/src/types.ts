export type FlagType = "boolean" | "string" | "number";
export type FlagValue = boolean | string | number;

export type Operator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "contains"
  | "startsWith"
  | "endsWith"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "regex";

export interface Condition {
  attr: string;
  op: Operator;
  value: unknown;
}

export interface TargetingRule {
  id: string;
  description?: string;
  conditions: Condition[];
  variant: string;
}

export interface FlagVariant {
  key: string;
  value: FlagValue;
}

export interface EnvironmentConfig {
  enabled: boolean;
  defaultVariant: string;
  rules: TargetingRule[];
  rollout?: { variant: string; percentage: number };
}

export interface Flag {
  _id: string;
  key: string;
  type: FlagType;
  description?: string;
  variants: FlagVariant[];
  environments: Record<string, EnvironmentConfig>;
  owner: string;
  createdAt: number;
  updatedAt: number;
}

export interface CompiledRule {
  conditions: Condition[];
  variant: string;
}

export interface CompiledFlag {
  key: string;
  type: FlagType;
  enabled: boolean;
  variants: Record<string, FlagValue>;
  defaultVariant: string;
  rules: CompiledRule[];
  rollout?: { variant: string; percentage: number };
}

export interface Ruleset {
  env: string;
  version: number;
  flags: CompiledFlag[];
  builtAt: number;
}

export interface EvalContext {
  userId?: string;
  attrs?: Record<string, unknown>;
}

export interface EvalResult {
  flag: string;
  value: FlagValue;
  variant: string;
  reason:
    | "disabled"
    | "rule_match"
    | "rollout"
    | "default"
    | "flag_missing";
}

export interface AuditEntry {
  _id: string;
  flagKey: string;
  env?: string;
  actor: string;
  action: "create" | "update" | "delete" | "toggle";
  diff?: Record<string, { before: unknown; after: unknown }>;
  ts: number;
}
