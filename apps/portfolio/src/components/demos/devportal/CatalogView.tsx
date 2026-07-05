"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, RefreshCw, Search, Activity } from "lucide-react";
import { Button, Badge, Card, CardBody, CardHeader, CardTitle } from "@portfolio/shared-ui";
import { DemoShell } from "@/components/demos/DemoShell";
import {
  FieldLabel,
  SelectInput,
  StatusPill,
  TextInput,
} from "@/components/demos/FormBits";
import {
  checkDevPortalHealth,
  getHealthRollup,
  listServices,
  registerManifest,
} from "@/lib/demos/devportal";
import type { DevPortalService, HealthRollup } from "@/lib/demos/types";

export function DeveloperPortalDemo() {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [services, setServices] = useState<DevPortalService[]>([]);
  const [rollup, setRollup] = useState<HealthRollup | null>(null);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState("");
  const [lifecycle, setLifecycle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const ok = await checkDevPortalHealth();
    setBackendOk(ok);
    if (!ok) {
      setLoading(false);
      return;
    }
    try {
      const [list, health] = await Promise.all([
        listServices({ q: q || undefined, tier: tier || undefined, lifecycle: lifecycle || undefined }),
        getHealthRollup(),
      ]);
      setServices(list.items);
      setRollup(health);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [q, tier, lifecycle]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <DemoShell
      title="Developer Portal"
      subtitle="Service catalog, health roll-up, OpenAPI cache, and API playground — wired to the real backend."
      backendOk={backendOk}
      backendPort={4600}
    >
      {rollup && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(rollup.summary).map(([status, count]) => (
            <Card key={status}>
              <CardBody className="py-4">
                <div className="flex items-center justify-between">
                  <StatusPill status={status} />
                  <span className="font-mono text-xl text-white">{count}</span>
                </div>
              </CardBody>
            </Card>
          ))}
          <Card>
            <CardBody className="py-4">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Total</div>
              <div className="font-mono text-xl text-cyan-300">{rollup.total}</div>
            </CardBody>
          </Card>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-6">
        <div className="flex-1 min-w-[200px]">
          <FieldLabel>Search</FieldLabel>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
            <TextInput
              className="pl-9"
              placeholder="name, id, tag…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
        <div className="w-32">
          <FieldLabel>Tier</FieldLabel>
          <SelectInput value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="">All</option>
            <option value="tier-0">tier-0</option>
            <option value="tier-1">tier-1</option>
            <option value="tier-2">tier-2</option>
            <option value="tier-3">tier-3</option>
          </SelectInput>
        </div>
        <div className="w-36">
          <FieldLabel>Lifecycle</FieldLabel>
          <SelectInput value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}>
            <option value="">All</option>
            <option value="ga">ga</option>
            <option value="beta">beta</option>
            <option value="experimental">experimental</option>
            <option value="deprecated">deprecated</option>
          </SelectInput>
        </div>
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button onClick={() => setShowRegister((s) => !s)}>
          <Plus className="h-4 w-4" />
          Register
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {showRegister && (
        <RegisterForm
          onDone={() => {
            setShowRegister(false);
            void refresh();
          }}
          onCancel={() => setShowRegister(false)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" />
            Service catalog
            <Badge tone="cyan">{services.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {loading && services.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Loading…</p>
          ) : services.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No services registered yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-3">Service</th>
                    <th className="px-4 py-3">Tier</th>
                    <th className="px-4 py-3">Lifecycle</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Health</th>
                    <th className="px-4 py-3">Ver</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map((s) => {
                    const health = rollup?.results.find((r) => r.serviceId === s.id);
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-white/5 hover:bg-white/[0.02]"
                      >
                        <td className="px-6 py-3">
                          <Link
                            href={`/demos/developer-portal/${s.id}`}
                            className="font-medium text-cyan-300 hover:text-cyan-200"
                          >
                            {s.name}
                          </Link>
                          <div className="font-mono text-xs text-slate-500">{s.id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone="violet">{s.tier}</Badge>
                        </td>
                        <td className="px-4 py-3">{s.lifecycle}</td>
                        <td className="px-4 py-3 text-slate-400">{s.owner.team}</td>
                        <td className="px-4 py-3">
                          {health ? (
                            <StatusPill status={health.status} />
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-400">v{s.version}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </DemoShell>
  );
}

function RegisterForm({
  onDone,
  onCancel,
}: {
  onDone: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    id: "",
    name: "",
    description: "",
    team: "",
    contact: "",
    tier: "tier-2",
    lifecycle: "beta",
    baseUrl: "http://127.0.0.1:8080",
    healthUrl: "http://127.0.0.1:8080/health",
    openapiUrl: "http://127.0.0.1:8080/openapi.json",
    tags: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      await registerManifest({
        id: form.id,
        name: form.name,
        description: form.description,
        owner: { team: form.team, contact: form.contact },
        tier: form.tier,
        lifecycle: form.lifecycle,
        baseUrl: form.baseUrl,
        healthUrl: form.healthUrl,
        openapiUrl: form.openapiUrl || undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()) : [],
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Register service manifest</CardTitle>
      </CardHeader>
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Service ID</FieldLabel>
          <TextInput value={form.id} onChange={(e) => set("id", e.target.value)} placeholder="billing-service" />
        </div>
        <div>
          <FieldLabel>Name</FieldLabel>
          <TextInput value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Description</FieldLabel>
          <TextInput value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Owner team</FieldLabel>
          <TextInput value={form.team} onChange={(e) => set("team", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Contact email</FieldLabel>
          <TextInput value={form.contact} onChange={(e) => set("contact", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Base URL</FieldLabel>
          <TextInput value={form.baseUrl} onChange={(e) => set("baseUrl", e.target.value)} />
        </div>
        <div>
          <FieldLabel>Health URL</FieldLabel>
          <TextInput value={form.healthUrl} onChange={(e) => set("healthUrl", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>OpenAPI URL</FieldLabel>
          <TextInput value={form.openapiUrl} onChange={(e) => set("openapiUrl", e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <FieldLabel>Tags (comma-separated)</FieldLabel>
          <TextInput value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="billing, core" />
        </div>
        {err && <p className="sm:col-span-2 text-sm text-rose-300">{err}</p>}
        <div className="sm:col-span-2 flex gap-2">
          <Button onClick={() => void submit()} disabled={busy}>
            {busy ? "Saving…" : "Register"}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
