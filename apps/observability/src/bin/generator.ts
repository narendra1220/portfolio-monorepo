import crypto from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4800";

function hex(bytes: number): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function nsNow(): string {
  return (BigInt(Date.now()) * 1_000_000n).toString();
}

function nsAt(ms: number): string {
  return (BigInt(ms) * 1_000_000n).toString();
}

interface SpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  service: string;
  startMs: number;
  durationMs: number;
  error?: boolean;
  kind?: number;
  attrs?: Record<string, string | number | boolean>;
}

function spanFromInput(s: SpanInput) {
  const startMs = s.startMs;
  const endMs = s.startMs + s.durationMs;
  const out: Record<string, unknown> = {
    traceId: s.traceId,
    spanId: s.spanId,
    name: s.name,
    kind: s.kind ?? 2,
    startTimeUnixNano: nsAt(startMs),
    endTimeUnixNano: nsAt(endMs),
    attributes: Object.entries(s.attrs ?? {}).map(([k, v]) => ({
      key: k,
      value:
        typeof v === "string"
          ? { stringValue: v }
          : typeof v === "boolean"
            ? { boolValue: v }
            : { doubleValue: v },
    })),
    status: { code: s.error ? 2 : 1 },
  };
  if (s.parentSpanId) out.parentSpanId = s.parentSpanId;
  return out;
}

function spansToPayload(
  service: string,
  spans: Record<string, unknown>[],
): unknown {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: service } },
            { key: "deployment.environment", value: { stringValue: "sim" } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "synthetic" },
            spans,
          },
        ],
      },
    ],
  };
}

async function send(
  path: string,
  body: unknown,
): Promise<{ status: number; body: unknown }> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
}

async function emitTrace(
  scenario: "fast_ok" | "slow_ok" | "error",
  i: number,
): Promise<{ traceId: string; scenario: string }> {
  const traceId = hex(16);
  const t0 = Date.now() - 50;
  const frontendId = hex(8);
  const apiId = hex(8);
  const dbId = hex(8);

  const slow = scenario === "slow_ok";
  const err = scenario === "error";

  const frontendDur = slow ? 850 : 40;
  const apiDur = slow ? 720 : 22;
  const dbDur = slow ? 600 : 6;

  await send(
    "/v1/traces",
    spansToPayload("frontend", [
      spanFromInput({
        traceId,
        spanId: frontendId,
        name: `GET /search?q=${i}`,
        service: "frontend",
        startMs: t0,
        durationMs: frontendDur,
        kind: 2,
        attrs: { "http.method": "GET", "http.target": `/search?q=${i}` },
      }),
    ]),
  );
  await send(
    "/v1/traces",
    spansToPayload("api", [
      spanFromInput({
        traceId,
        spanId: apiId,
        parentSpanId: frontendId,
        name: "api: /v1/search",
        service: "api",
        startMs: t0 + 5,
        durationMs: apiDur,
        kind: 2,
        attrs: { "http.route": "/v1/search" },
      }),
    ]),
  );
  await send(
    "/v1/traces",
    spansToPayload("db", [
      spanFromInput({
        traceId,
        spanId: dbId,
        parentSpanId: apiId,
        name: "db: SELECT search",
        service: "db",
        startMs: t0 + 10,
        durationMs: dbDur,
        error: err,
        kind: 3,
        attrs: { "db.system": "postgres", "db.statement": "SELECT ..." },
      }),
    ]),
  );

  if (err) {
    await send(
      "/v1/logs",
      {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: "service.name", value: { stringValue: "db" } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: "synthetic" },
                logRecords: [
                  {
                    timeUnixNano: nsNow(),
                    severityText: "ERROR",
                    body: { stringValue: "deadlock detected" },
                    traceId,
                    spanId: dbId,
                    attributes: [
                      { key: "code", value: { stringValue: "40P01" } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    );
  }

  return { traceId, scenario };
}

async function pollUntilFlushed(
  expectMin: number,
  timeoutMs = 8000,
): Promise<void> {
  const start = Date.now();
  let last: { flushed: number; dropped: number; buffered: number } = {
    flushed: 0,
    dropped: 0,
    buffered: 0,
  };
  while (Date.now() - start < timeoutMs) {
    const r = await fetch(`${BASE}/stats`);
    const s = (await r.json()) as {
      tracesFlushed: number;
      tracesDropped: number;
      tracesBuffered: number;
    };
    last = {
      flushed: s.tracesFlushed,
      dropped: s.tracesDropped,
      buffered: s.tracesBuffered,
    };
    if (last.buffered === 0 && last.flushed + last.dropped >= expectMin) return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`flush timeout, last=${JSON.stringify(last)}`);
}

function log(label: string, data: unknown): void {
  console.log(`\n=== ${label} ===\n${JSON.stringify(data, null, 2)}`);
}

async function main(): Promise<void> {
  const emitted: Array<{ traceId: string; scenario: string }> = [];

  emitted.push(await emitTrace("error", 0));
  emitted.push(await emitTrace("slow_ok", 1));
  for (let i = 2; i < 12; i++) emitted.push(await emitTrace("fast_ok", i));

  log("emitted", {
    total: emitted.length,
    byScenario: emitted.reduce<Record<string, number>>((acc, e) => {
      acc[e.scenario] = (acc[e.scenario] ?? 0) + 1;
      return acc;
    }, {}),
  });

  log("waiting for tail-sampling worker to flush", {
    note: "bufferHoldMs=3000 + flushIntervalMs=1000",
  });
  await pollUntilFlushed(emitted.length);

  const stats = await fetch(`${BASE}/stats`).then((r) => r.json());
  log("ingest stats", stats);

  const errored = (await fetch(`${BASE}/traces?hasErrors=true`).then((r) =>
    r.json(),
  )) as { count: number; items: Array<{ traceId: string; sampledReason: string }> };
  log("traces with errors", {
    count: errored.count,
    sampledReasons: errored.items.map((t) => t.sampledReason),
  });

  const slow = (await fetch(`${BASE}/traces?minDurationMs=500`).then((r) =>
    r.json(),
  )) as { count: number; items: Array<{ traceId: string; durationMs: number; sampledReason: string }> };
  log("traces durationMs >= 500", {
    count: slow.count,
    items: slow.items.map((t) => ({
      traceId: t.traceId.slice(0, 8) + "...",
      durationMs: Math.round(t.durationMs),
      sampledReason: t.sampledReason,
    })),
  });

  if (errored.items.length > 0) {
    const id = errored.items[0]!.traceId;
    const trace = (await fetch(`${BASE}/trace/${id}`).then((r) => r.json())) as {
      trace: { traceId: string; durationMs: number; serviceCount: number };
      spans: Array<{ serviceName: string; name: string; status: string; durationMs: number }>;
    };
    log("full trace tree (errored)", {
      traceId: trace.trace.traceId.slice(0, 8) + "...",
      durationMs: Math.round(trace.trace.durationMs),
      serviceCount: trace.trace.serviceCount,
      spans: trace.spans.map((s) => ({
        service: s.serviceName,
        name: s.name,
        status: s.status,
        ms: Math.round(s.durationMs),
      })),
    });
    const logs = (await fetch(`${BASE}/logs?traceId=${id}`).then((r) =>
      r.json(),
    )) as { items: Array<{ severity: string; body: string }> };
    log("logs joined by traceId", logs);
  }

  const map = await fetch(`${BASE}/servicemap`).then((r) => r.json());
  log("service map", map);

  log("done", { ok: true });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
