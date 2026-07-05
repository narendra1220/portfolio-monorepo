import type {
  CompiledFlag,
  Condition,
  EvalContext,
  EvalResult,
  FlagValue,
  Operator,
  Ruleset,
} from "../types.js";
import { inRollout } from "./bucket.js";

function readAttr(ctx: EvalContext, attr: string): unknown {
  if (attr === "userId") return ctx.userId;
  if (attr.startsWith("attrs.")) {
    const key = attr.slice("attrs.".length);
    return ctx.attrs?.[key];
  }
  return ctx.attrs?.[attr];
}

const ops: Record<Operator, (lhs: unknown, rhs: unknown) => boolean> = {
  eq: (l, r) => l === r,
  neq: (l, r) => l !== r,
  in: (l, r) => Array.isArray(r) && r.includes(l),
  notIn: (l, r) => Array.isArray(r) && !r.includes(l),
  contains: (l, r) =>
    typeof l === "string" && typeof r === "string" && l.includes(r),
  startsWith: (l, r) =>
    typeof l === "string" && typeof r === "string" && l.startsWith(r),
  endsWith: (l, r) =>
    typeof l === "string" && typeof r === "string" && l.endsWith(r),
  gt: (l, r) => typeof l === "number" && typeof r === "number" && l > r,
  gte: (l, r) => typeof l === "number" && typeof r === "number" && l >= r,
  lt: (l, r) => typeof l === "number" && typeof r === "number" && l < r,
  lte: (l, r) => typeof l === "number" && typeof r === "number" && l <= r,
  regex: (l, r) =>
    typeof l === "string" && typeof r === "string" && new RegExp(r).test(l),
};

function matchAll(conditions: Condition[], ctx: EvalContext): boolean {
  for (const c of conditions) {
    const lhs = readAttr(ctx, c.attr);
    const fn = ops[c.op];
    if (!fn || !fn(lhs, c.value)) return false;
  }
  return true;
}

function resolveValue(
  flag: CompiledFlag,
  variant: string,
): FlagValue | undefined {
  return flag.variants[variant];
}

export function evalFlag(
  flag: CompiledFlag,
  ctx: EvalContext,
): EvalResult {
  if (!flag.enabled) {
    return {
      flag: flag.key,
      variant: flag.defaultVariant,
      value: resolveValue(flag, flag.defaultVariant) ?? falseyForType(flag),
      reason: "disabled",
    };
  }
  for (const rule of flag.rules) {
    if (matchAll(rule.conditions, ctx)) {
      const v = resolveValue(flag, rule.variant);
      if (v !== undefined) {
        return {
          flag: flag.key,
          variant: rule.variant,
          value: v,
          reason: "rule_match",
        };
      }
    }
  }
  if (flag.rollout && ctx.userId) {
    if (inRollout(ctx.userId, flag.key, flag.rollout.percentage)) {
      const v = resolveValue(flag, flag.rollout.variant);
      if (v !== undefined) {
        return {
          flag: flag.key,
          variant: flag.rollout.variant,
          value: v,
          reason: "rollout",
        };
      }
    }
  }
  return {
    flag: flag.key,
    variant: flag.defaultVariant,
    value: resolveValue(flag, flag.defaultVariant) ?? falseyForType(flag),
    reason: "default",
  };
}

function falseyForType(flag: CompiledFlag): FlagValue {
  switch (flag.type) {
    case "boolean":
      return false;
    case "string":
      return "";
    case "number":
      return 0;
  }
}

export class RulesetIndex {
  private byKey = new Map<string, CompiledFlag>();
  readonly env: string;
  readonly version: number;

  constructor(ruleset: Ruleset) {
    this.env = ruleset.env;
    this.version = ruleset.version;
    for (const f of ruleset.flags) this.byKey.set(f.key, f);
  }

  evaluate(key: string, ctx: EvalContext): EvalResult {
    const flag = this.byKey.get(key);
    if (!flag) {
      return {
        flag: key,
        variant: "",
        value: false,
        reason: "flag_missing",
      };
    }
    return evalFlag(flag, ctx);
  }
}
