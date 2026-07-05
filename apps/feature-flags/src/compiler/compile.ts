import type { CompiledFlag, Flag, Ruleset } from "../types.js";

export function compileFlag(flag: Flag, env: string): CompiledFlag | null {
  const cfg = flag.environments[env];
  if (!cfg) return null;
  const variantMap: Record<string, CompiledFlag["variants"][string]> = {};
  for (const v of flag.variants) variantMap[v.key] = v.value;
  const compiled: CompiledFlag = {
    key: flag.key,
    type: flag.type,
    enabled: cfg.enabled,
    variants: variantMap,
    defaultVariant: cfg.defaultVariant,
    rules: (cfg.rules ?? []).map((r) => ({
      conditions: r.conditions,
      variant: r.variant,
    })),
  };
  if (cfg.rollout) compiled.rollout = cfg.rollout;
  return compiled;
}

export function compileRuleset(
  flags: Flag[],
  env: string,
  version: number,
): Ruleset {
  const compiled: CompiledFlag[] = [];
  for (const f of flags) {
    const c = compileFlag(f, env);
    if (c) compiled.push(c);
  }
  return {
    env,
    version,
    flags: compiled,
    builtAt: Date.now(),
  };
}
