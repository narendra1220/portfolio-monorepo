import { ulid } from "ulid";
import type { LogDoc, SpanAttrs, SpanDoc, SpanKind, SpanStatus } from "../types.js";

interface OtlpAnyValue {
  stringValue?: string;
  intValue?: string | number;
  doubleValue?: number;
  boolValue?: boolean;
  arrayValue?: { values: OtlpAnyValue[] };
}
interface OtlpKeyValue {
  key: string;
  value?: OtlpAnyValue;
}

interface OtlpResource {
  attributes?: OtlpKeyValue[];
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  startTimeUnixNano: string | number;
  endTimeUnixNano: string | number;
  attributes?: OtlpKeyValue[];
  status?: { code?: number; message?: string };
}

interface OtlpScopeSpans {
  scope?: { name?: string };
  spans: OtlpSpan[];
}

interface OtlpResourceSpans {
  resource?: OtlpResource;
  scopeSpans: OtlpScopeSpans[];
}

interface OtlpTracesPayload {
  resourceSpans: OtlpResourceSpans[];
}

interface OtlpLogRecord {
  timeUnixNano?: string | number;
  observedTimeUnixNano?: string | number;
  severityNumber?: number;
  severityText?: string;
  body?: OtlpAnyValue;
  traceId?: string;
  spanId?: string;
  attributes?: OtlpKeyValue[];
}

interface OtlpScopeLogs {
  scope?: { name?: string };
  logRecords: OtlpLogRecord[];
}

interface OtlpResourceLogs {
  resource?: OtlpResource;
  scopeLogs: OtlpScopeLogs[];
}

interface OtlpLogsPayload {
  resourceLogs: OtlpResourceLogs[];
}

const KIND_MAP: Record<number, SpanKind> = {
  0: "internal",
  1: "internal",
  2: "server",
  3: "client",
  4: "producer",
  5: "consumer",
};

function attrsToMap(kvs?: OtlpKeyValue[]): SpanAttrs {
  const out: SpanAttrs = {};
  if (!kvs) return out;
  for (const kv of kvs) {
    const v = kv.value;
    if (!v) continue;
    if (typeof v.stringValue === "string") out[kv.key] = v.stringValue;
    else if (typeof v.boolValue === "boolean") out[kv.key] = v.boolValue;
    else if (typeof v.doubleValue === "number") out[kv.key] = v.doubleValue;
    else if (v.intValue !== undefined)
      out[kv.key] = typeof v.intValue === "string" ? Number(v.intValue) : v.intValue;
    else if (v.arrayValue?.values?.length) {
      out[kv.key] = v.arrayValue.values
        .map((x) => x.stringValue ?? "")
        .join(",");
    }
  }
  return out;
}

function nsToMs(v: string | number): number {
  const n = typeof v === "string" ? Number(v) : v;
  return n / 1_000_000;
}

function statusFromCode(code?: number): SpanStatus {
  if (code === 1) return "ok";
  if (code === 2) return "error";
  return "unset";
}

export function parseOtlpTraces(payload: OtlpTracesPayload): SpanDoc[] {
  const out: SpanDoc[] = [];
  const ts = Date.now();
  for (const rs of payload.resourceSpans ?? []) {
    const resourceAttrs = attrsToMap(rs.resource?.attributes);
    const serviceName = (resourceAttrs["service.name"] as string) || "unknown";
    for (const ss of rs.scopeSpans ?? []) {
      for (const s of ss.spans ?? []) {
        const start = nsToMs(s.startTimeUnixNano);
        const end = nsToMs(s.endTimeUnixNano);
        const attrs = attrsToMap(s.attributes);
        const doc: SpanDoc = {
          _id: ulid(),
          traceId: s.traceId,
          spanId: s.spanId,
          name: s.name,
          kind: KIND_MAP[s.kind ?? 0] ?? "internal",
          serviceName,
          startMs: start,
          endMs: end,
          durationMs: Math.max(0, end - start),
          status: statusFromCode(s.status?.code),
          attributes: attrs,
          resourceAttributes: resourceAttrs,
          ingestedAt: ts,
        };
        if (s.parentSpanId) doc.parentSpanId = s.parentSpanId;
        if (s.status?.message) doc.statusMessage = s.status.message;
        out.push(doc);
      }
    }
  }
  return out;
}

export function parseOtlpLogs(payload: OtlpLogsPayload): LogDoc[] {
  const out: LogDoc[] = [];
  const ts = Date.now();
  for (const rl of payload.resourceLogs ?? []) {
    const resourceAttrs = attrsToMap(rl.resource?.attributes);
    const serviceName = (resourceAttrs["service.name"] as string) || "unknown";
    for (const sl of rl.scopeLogs ?? []) {
      for (const lr of sl.logRecords ?? []) {
        const tsMs = lr.timeUnixNano
          ? nsToMs(lr.timeUnixNano)
          : lr.observedTimeUnixNano
            ? nsToMs(lr.observedTimeUnixNano)
            : ts;
        const doc: LogDoc = {
          _id: ulid(),
          ts: tsMs,
          severity: lr.severityText ?? severityNumberToText(lr.severityNumber),
          body: lr.body?.stringValue ?? "",
          serviceName,
          attributes: attrsToMap(lr.attributes),
          ingestedAt: ts,
        };
        if (lr.traceId) doc.traceId = lr.traceId;
        if (lr.spanId) doc.spanId = lr.spanId;
        out.push(doc);
      }
    }
  }
  return out;
}

function severityNumberToText(n?: number): string {
  if (n === undefined) return "INFO";
  if (n >= 21) return "FATAL";
  if (n >= 17) return "ERROR";
  if (n >= 13) return "WARN";
  if (n >= 9) return "INFO";
  if (n >= 5) return "DEBUG";
  return "TRACE";
}
