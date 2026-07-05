"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Radio } from "lucide-react";
import { Button, Badge, Card, CardBody, CardHeader, CardTitle } from "@portfolio/shared-ui";
import { DemoShell } from "@/components/demos/DemoShell";
import { FieldLabel, StatusPill, TextInput } from "@/components/demos/FormBits";
import {
  checkFlagsHealth,
  createFlag,
  getLatestRulesetVersion,
  listFlags,
  subscribeRulesetSse,
} from "@/lib/demos/feature-flags";
import type { FeatureFlag } from "@/lib/demos/types";

export function FeatureFlagsDemo() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rulesetVersion, setRulesetVersion] = useState<number | null>(null);
  const [sseConnected, setSseConnected] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const env = "dev";

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ok = await checkFlagsHealth();
    setBackendOk(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    try {
      const [list, ver] = await Promise.all([listFlags(), getLatestRulesetVersion(env)]);
      setFlags(list);
      setRulesetVersion(ver);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!backendOk) return;
    setSseConnected(true);
    const unsub = subscribeRulesetSse(
      env,
      (v) => {
        setRulesetVersion(v);
        void refresh();
      },
      () => setSseConnected(false),
    );
    return unsub;
  }, [backendOk, env, refresh]);

  return (
    <DemoShell
      title="Feature Flags"
      subtitle="Admin UI for flags, targeting rules, percentage rollouts, and live evaluation — backed by SSE propagation."
      backendOk={backendOk}
      backendPort={4500}
    >
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Card className="flex-1 min-w-[200px]">
          <CardBody className="py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <Radio className={`h-4 w-4 ${sseConnected ? "text-emerald-400" : "text-slate-500"}`} />
              <span className="text-slate-300">SSE stream</span>
            </div>
            <StatusPill status={sseConnected ? "up" : "down"} />
          </CardBody>
        </Card>
        <Card className="flex-1 min-w-[200px]">
          <CardBody className="py-3">
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Ruleset version ({env})</div>
            <div className="font-mono text-xl text-cyan-300">{rulesetVersion ?? "—"}</div>
          </CardBody>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button onClick={() => setShowCreate((s) => !s)}>
          <Plus className="h-4 w-4" />
          New flag
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {showCreate && (
        <CreateFlagForm
          onDone={() => {
            setShowCreate(false);
            void refresh();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Flags
            <Badge tone="cyan">{flags.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {loading && flags.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : flags.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No flags yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3">Key</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Environments</th>
                    <th className="px-4 py-3">Owner</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.key} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-6 py-3">
                        <Link
                          href={`/demos/feature-flags/${encodeURIComponent(f.key)}`}
                          className="font-mono text-cyan-300 hover:text-cyan-200"
                        >
                          {f.key}
                        </Link>
                        {f.description && (
                          <div className="text-xs text-slate-500 mt-0.5">{f.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="violet">{f.type}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(f.environments).map(([envName, cfg]) => (
                            <StatusPill
                              key={envName}
                              status={cfg.enabled ? "enabled" : "disabled"}
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">{f.owner}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </DemoShell>
  );
}

function CreateFlagForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [rolloutPct, setRolloutPct] = useState(50);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await createFlag({
        key,
        type: "boolean",
        description,
        variants: [
          { key: "on", value: true },
          { key: "off", value: false },
        ],
        environments: {
          dev: {
            enabled: true,
            defaultVariant: "off",
            rules: [
              {
                conditions: [{ attr: "attrs.role", op: "eq", value: "beta" }],
                variant: "on",
              },
            ],
            rollout: { variant: "on", percentage: rolloutPct },
          },
        },
        owner: "portfolio-ui",
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader><CardTitle>Create boolean flag</CardTitle></CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Key</FieldLabel>
          <TextInput value={key} onChange={(e) => setKey(e.target.value)} placeholder="new_checkout" />
        </div>
        <div>
          <FieldLabel>Rollout % (dev)</FieldLabel>
          <TextInput
            type="number"
            min={0}
            max={100}
            value={rolloutPct}
            onChange={(e) => setRolloutPct(Number(e.target.value))}
          />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <p className="sm:col-span-2 text-xs text-slate-500">
          Includes a default rule: <code className="text-slate-400">attrs.role == &quot;beta&quot;</code> → on variant.
        </p>
        {err && <p className="sm:col-span-2 text-sm text-rose-300">{err}</p>}
        <div className="sm:col-span-2 flex gap-2">
          <Button onClick={() => void submit()} disabled={busy || !key}>
            {busy ? "Creating…" : "Create flag"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        </div>
      </CardBody>
    </Card>
  );
}
