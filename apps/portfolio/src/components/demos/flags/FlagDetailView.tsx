"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Trash2, Zap } from "lucide-react";
import { Button, Badge, Card, CardBody, CardHeader, CardTitle } from "@portfolio/shared-ui";
import { DemoShell } from "@/components/demos/DemoShell";
import {
  FieldLabel,
  JsonBlock,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/demos/FormBits";
import {
  checkFlagsHealth,
  deleteFlag,
  evalFlag,
  getFlag,
  getLatestRulesetVersion,
  patchFlagEnv,
  subscribeRulesetSse,
} from "@/lib/demos/feature-flags";
import type { EvalResult, FeatureFlag } from "@/lib/demos/types";

export function FlagDetailDemo({ flagKey }: { flagKey: string }) {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [flag, setFlag] = useState<FeatureFlag | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesetVersion, setRulesetVersion] = useState<number | null>(null);
  const env = "dev";

  const load = useCallback(async () => {
    setError(null);
    const ok = await checkFlagsHealth();
    setBackendOk(ok);
    if (!ok) return;
    try {
      const [f, ver] = await Promise.all([
        getFlag(flagKey),
        getLatestRulesetVersion(env),
      ]);
      setFlag(f);
      setRulesetVersion(ver);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [flagKey, env]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!backendOk) return;
    return subscribeRulesetSse(env, (v) => {
      setRulesetVersion(v);
      void load();
    }, () => {});
  }, [backendOk, env, load]);

  const cfg = flag?.environments[env];

  return (
    <DemoShell
      title="Feature Flags"
      subtitle={flagKey}
      backendOk={backendOk}
      backendPort={4500}
    >
      <Link
        href="/demos/feature-flags"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to flags
      </Link>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {flag && cfg && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Badge tone="violet">{flag.type}</Badge>
            <StatusPill status={cfg.enabled ? "enabled" : "disabled"} />
            <span className="font-mono text-xs text-slate-500">
              ruleset v{rulesetVersion ?? "?"}
            </span>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm(`Delete ${flag.key}?`)) return;
                  await deleteFlag(flag.key);
                  window.location.href = "/demos/feature-flags";
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <EnvEditor
              flagKey={flag.key}
              cfg={cfg}
              onSaved={() => void load()}
            />
            <EvalPanel flagKey={flag.key} env={env} />
          </div>

          <Card className="mt-6">
            <CardHeader><CardTitle>Targeting rules ({env})</CardTitle></CardHeader>
            <CardBody>
              {cfg.rules.length === 0 ? (
                <p className="text-sm text-slate-500">No rules — default variant only.</p>
              ) : (
                <ul className="space-y-3">
                  {cfg.rules.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-sm"
                    >
                      <div className="font-mono text-cyan-300">→ {r.variant}</div>
                      <div className="mt-1 text-xs text-slate-400">
                        {r.conditions.map((c) => `${c.attr} ${c.op} ${JSON.stringify(c.value)}`).join(" AND ")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </DemoShell>
  );
}

function EnvEditor({
  flagKey,
  cfg,
  onSaved,
}: {
  flagKey: string;
  cfg: FeatureFlag["environments"][string];
  onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(cfg.enabled);
  const [defaultVariant, setDefaultVariant] = useState(cfg.defaultVariant);
  const [rolloutPct, setRolloutPct] = useState(cfg.rollout?.percentage ?? 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(cfg.enabled);
    setDefaultVariant(cfg.defaultVariant);
    setRolloutPct(cfg.rollout?.percentage ?? 0);
  }, [cfg]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await patchFlagEnv(flagKey, "dev", {
        enabled,
        defaultVariant,
        rollout: { variant: "on", percentage: rolloutPct },
      });
      setMsg("Saved — SSE should bump ruleset version");
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Environment: dev</CardTitle></CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3">
          <FieldLabel>Enabled</FieldLabel>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((e) => !e)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              enabled ? "bg-cyan-500" : "bg-slate-600"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                enabled ? "left-5" : "left-0.5"
              }`}
            />
          </button>
        </div>
        <div>
          <FieldLabel>Default variant</FieldLabel>
          <SelectInput
            value={defaultVariant}
            onChange={(e) => setDefaultVariant(e.target.value)}
          >
            <option value="on">on</option>
            <option value="off">off</option>
          </SelectInput>
        </div>
        <div>
          <FieldLabel>Rollout to &quot;on&quot; (%)</FieldLabel>
          <input
            type="range"
            min={0}
            max={100}
            value={rolloutPct}
            onChange={(e) => setRolloutPct(Number(e.target.value))}
            className="w-full accent-cyan-400"
          />
          <div className="mt-1 font-mono text-sm text-cyan-300">{rolloutPct}%</div>
        </div>
        <Button onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
        {msg && <p className="text-xs text-slate-400">{msg}</p>}
      </CardBody>
    </Card>
  );
}

function EvalPanel({ flagKey, env }: { flagKey: string; env: string }) {
  const [userId, setUserId] = useState("user-demo-1");
  const [role, setRole] = useState("");
  const [result, setResult] = useState<EvalResult | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await evalFlag({
        flag: flagKey,
        env,
        context: {
          userId,
          attrs: role ? { role } : {},
        },
      });
      setResult(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-400" />
          Live evaluation
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div>
          <FieldLabel>User ID (sticky bucket)</FieldLabel>
          <TextInput value={userId} onChange={(e) => setUserId(e.target.value)} />
        </div>
        <div>
          <FieldLabel>attrs.role</FieldLabel>
          <SelectInput value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">(empty)</option>
            <option value="beta">beta</option>
            <option value="standard">standard</option>
          </SelectInput>
        </div>
        <Button variant="secondary" onClick={() => void run()} disabled={busy}>
          {busy ? "Evaluating…" : "Evaluate"}
        </Button>
        {result && (
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              <Badge tone={result.value === true ? "green" : "neutral"}>
                {String(result.value)}
              </Badge>
              <Badge tone="cyan">{result.variant}</Badge>
              <Badge tone="amber">{result.reason}</Badge>
              {result.rulesetVersion != null && (
                <span className="text-xs font-mono text-slate-500">
                  v{result.rulesetVersion}
                </span>
              )}
            </div>
            <JsonBlock data={result} />
          </div>
        )}
      </CardBody>
    </Card>
  );
}
