"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Trash2 } from "lucide-react";
import { Button, Badge, Card, CardBody, CardHeader, CardTitle } from "@portfolio/shared-ui";
import { DemoShell } from "@/components/demos/DemoShell";
import {
  FieldLabel,
  JsonBlock,
  SelectInput,
  StatusPill,
  TextArea,
  TextInput,
} from "@/components/demos/FormBits";
import {
  checkDevPortalHealth,
  deleteService,
  getOpenAPI,
  getService,
  listVersions,
  runPlayground,
} from "@/lib/demos/devportal";
import type { DevPortalService, PlaygroundResult } from "@/lib/demos/types";

type Tab = "overview" | "openapi" | "playground" | "versions";

export function ServiceDetailDemo({ serviceId }: { serviceId: string }) {
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [service, setService] = useState<DevPortalService | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const ok = await checkDevPortalHealth();
    setBackendOk(ok);
    if (!ok) return;
    try {
      setService(await getService(serviceId));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [serviceId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DemoShell
      title="Developer Portal"
      subtitle={service ? service.name : serviceId}
      backendOk={backendOk}
      backendPort={4600}
    >
      <Link
        href="/demos/developer-portal"
        className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to catalog
      </Link>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-400/30 bg-rose-400/5 px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {service && (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <Badge tone="violet">{service.tier}</Badge>
            <Badge tone="cyan">{service.lifecycle}</Badge>
            <span className="font-mono text-xs text-slate-500">v{service.version}</span>
            <span className="text-xs text-slate-500">· {service.owner.team}</span>
            <div className="ml-auto">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (!confirm(`Delete ${service.id}?`)) return;
                  await deleteService(service.id);
                  window.location.href = "/demos/developer-portal";
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-b border-white/5 pb-4 mb-6">
            {(["overview", "openapi", "playground", "versions"] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-lg px-3 py-1.5 text-sm capitalize transition-colors ${
                  tab === t
                    ? "bg-cyan-400/10 text-cyan-300 border border-cyan-400/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "overview" && <OverviewTab service={service} />}
          {tab === "openapi" && <OpenAPITab serviceId={service.id} />}
          {tab === "playground" && <PlaygroundTab serviceId={service.id} />}
          {tab === "versions" && <VersionsTab serviceId={service.id} />}
        </>
      )}
    </DemoShell>
  );
}

function OverviewTab({ service }: { service: DevPortalService }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Manifest</CardTitle></CardHeader>
        <CardBody className="space-y-3 text-sm">
          <Row label="ID" value={service.id} mono />
          <Row label="Base URL" value={service.baseUrl} mono />
          <Row label="Health URL" value={service.healthUrl} mono />
          {service.openapiUrl && <Row label="OpenAPI" value={service.openapiUrl} mono />}
          <Row label="Contact" value={service.owner.contact} />
          {service.tags?.length ? (
            <div>
              <FieldLabel>Tags</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {service.tags.map((t) => (
                  <Badge key={t} tone="neutral">{t}</Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardBody>
      </Card>
      <Card>
        <CardHeader><CardTitle>Description</CardTitle></CardHeader>
        <CardBody>
          <p className="text-sm text-slate-300 leading-relaxed">{service.description}</p>
        </CardBody>
      </Card>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div className={mono ? "font-mono text-xs text-slate-300 break-all" : "text-slate-300"}>
        {value}
      </div>
    </div>
  );
}

function OpenAPITab({ serviceId }: { serviceId: string }) {
  const [data, setData] = useState<{ source: string; doc: unknown } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const r = await getOpenAPI(serviceId);
        setData({ source: r.source, doc: r.doc });
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [serviceId]);

  if (loading) return <p className="text-sm text-slate-500">Fetching OpenAPI…</p>;
  if (err) return <p className="text-sm text-rose-300">{err}</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          OpenAPI spec
          {data && <Badge tone={data.source === "cache" ? "green" : "amber"}>{data.source}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardBody>{data && <JsonBlock data={data.doc} />}</CardBody>
    </Card>
  );
}

function PlaygroundTab({ serviceId }: { serviceId: string }) {
  const [method, setMethod] = useState("GET");
  const [path, setPath] = useState("/");
  const [headers, setHeaders] = useState('{"x-trace-id": "demo-123"}');
  const [body, setBody] = useState("{}");
  const [result, setResult] = useState<PlaygroundResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      let parsedHeaders: Record<string, string> = {};
      let parsedBody: unknown;
      try {
        parsedHeaders = JSON.parse(headers) as Record<string, string>;
      } catch {
        throw new Error("Headers must be valid JSON");
      }
      if (method !== "GET") {
        try {
          parsedBody = JSON.parse(body);
        } catch {
          parsedBody = body;
        }
      }
      const r = await runPlayground(serviceId, {
        method,
        path,
        headers: parsedHeaders,
        body: parsedBody,
      });
      setResult(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle>Request</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <FieldLabel>Method</FieldLabel>
              <SelectInput value={method} onChange={(e) => setMethod(e.target.value)}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </SelectInput>
            </div>
            <div className="col-span-2">
              <FieldLabel>Path</FieldLabel>
              <TextInput value={path} onChange={(e) => setPath(e.target.value)} placeholder="/echo" />
            </div>
          </div>
          <div>
            <FieldLabel>Headers (JSON)</FieldLabel>
            <TextArea rows={3} value={headers} onChange={(e) => setHeaders(e.target.value)} />
          </div>
          {method !== "GET" && (
            <div>
              <FieldLabel>Body (JSON)</FieldLabel>
              <TextArea rows={4} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
          )}
          <Button onClick={() => void run()} disabled={busy}>
            <Play className="h-4 w-4" />
            {busy ? "Sending…" : "Send request"}
          </Button>
          {err && <p className="text-sm text-rose-300">{err}</p>}
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            Response
            {result && (
              <span className="ml-2 font-mono text-sm text-slate-400">
                {result.status} · {result.durationMs}ms
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardBody>
          {result ? <JsonBlock data={result.body} /> : (
            <p className="text-sm text-slate-500">Run a request to see the proxied response.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function VersionsTab({ serviceId }: { serviceId: string }) {
  const [items, setItems] = useState<Array<{ version: number; ts: number; changedBy: string }>>([]);

  useEffect(() => {
    void listVersions(serviceId).then((r) => setItems(r.items));
  }, [serviceId]);

  return (
    <Card>
      <CardHeader><CardTitle>Version history</CardTitle></CardHeader>
      <CardBody className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-6 py-3">Version</th>
              <th className="px-4 py-3">Changed by</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr key={v.version} className="border-b border-white/5">
                <td className="px-6 py-3 font-mono text-cyan-300">v{v.version}</td>
                <td className="px-4 py-3 text-slate-400">{v.changedBy}</td>
                <td className="px-4 py-3 text-slate-500">
                  {new Date(v.ts).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardBody>
    </Card>
  );
}
