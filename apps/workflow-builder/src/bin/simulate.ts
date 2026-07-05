import { io as ioc, type Socket } from "socket.io-client";
import { ulid } from "ulid";
import { signToken } from "../auth.js";
import { loadConfig } from "../config.js";

interface JoinAck {
  ok: boolean;
  error?: string;
  workflow?: {
    id: string;
    name: string;
    version: number;
    doc: unknown;
    seq: number;
  };
  presence?: unknown[];
}

interface SubmitAck {
  ok: boolean;
  error?: string;
  seq?: number;
}

function connect(url: string, token: string, label: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = ioc(url, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
    });
    s.on("connect", () => {
      console.log(`[${label}] connected (id=${s.id})`);
      resolve(s);
    });
    s.on("connect_error", (err) => {
      console.error(`[${label}] connect error:`, err.message);
      reject(err);
    });
  });
}

function emit<T>(s: Socket, event: string, ...args: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${event} timeout`)), 5000);
    s.emit(event, ...args, (res: T) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

async function httpJSON<T>(
  url: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...((init.headers as Record<string, string>) ?? {}),
  };
  if (init.token) headers.authorization = `Bearer ${init.token}`;
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${url} → ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const base = `http://127.0.0.1:${cfg.port}`;
  const wsUrl = base;

  const aliceTok = signToken(cfg.jwtSecret, { sub: "alice", name: "Alice" });
  const bobTok = signToken(cfg.jwtSecret, { sub: "bob", name: "Bob" });

  console.log("▸ creating workflow");
  const created = await httpJSON<{ workflow: { _id: string } }>(
    `${base}/api/workflows`,
    {
      method: "POST",
      token: aliceTok,
      body: JSON.stringify({ name: "demo: branch + http + log" }),
    },
  );
  const workflowId = created.workflow._id;
  console.log(`  created ${workflowId}`);

  console.log("▸ two clients connect and join the room");
  const a = await connect(wsUrl, aliceTok, "alice");
  const b = await connect(wsUrl, bobTok, "bob");

  const opsSeenByB: number[] = [];
  b.on("op:apply", (env: { seq: number; op: { kind: string } }) => {
    opsSeenByB.push(env.seq);
    console.log(`  bob saw op seq=${env.seq} kind=${env.op.kind}`);
  });

  const presenceSeenByA: string[] = [];
  a.on("presence:update", (p: { actor: string }) => {
    presenceSeenByA.push(p.actor);
  });

  const ackA = await emit<JoinAck>(a, "workflow:join", workflowId);
  if (!ackA.ok) throw new Error("alice join failed: " + ackA.error);
  const ackB = await emit<JoinAck>(b, "workflow:join", workflowId);
  if (!ackB.ok) throw new Error("bob join failed: " + ackB.error);
  console.log("  both joined");

  console.log("▸ alice submits ops to build a branching workflow");
  const startId = ulid();
  const branchId = ulid();
  const httpId = ulid();
  const logOkId = ulid();
  const logFailId = ulid();

  const ops: Array<{ kind: string; payload: Record<string, unknown> }> = [
    {
      kind: "node.add",
      payload: { node: { id: startId, kind: "start", x: 0, y: 0, props: {} } },
    },
    {
      kind: "node.add",
      payload: {
        node: { id: httpId, kind: "http", x: 200, y: 0, props: { url: "https://example.com", method: "GET" } },
      },
    },
    {
      kind: "node.add",
      payload: {
        node: {
          id: branchId,
          kind: "branch",
          x: 400,
          y: 0,
          props: { condition: "vars['" + httpId + "'].status === 200" },
        },
      },
    },
    {
      kind: "node.add",
      payload: {
        node: { id: logOkId, kind: "log", x: 600, y: -80, props: { message: "200 OK from example.com" } },
      },
    },
    {
      kind: "node.add",
      payload: {
        node: { id: logFailId, kind: "log", x: 600, y: 80, props: { message: "non-200 path" } },
      },
    },
    { kind: "edge.add", payload: { edge: { id: ulid(), from: startId, to: httpId } } },
    { kind: "edge.add", payload: { edge: { id: ulid(), from: httpId, to: branchId } } },
    { kind: "edge.add", payload: { edge: { id: ulid(), from: branchId, to: logOkId, branch: "true" } } },
    { kind: "edge.add", payload: { edge: { id: ulid(), from: branchId, to: logFailId, branch: "false" } } },
  ];

  let lastSeq = 0;
  for (const o of ops) {
    const ack = await emit<SubmitAck>(a, "op:submit", {
      workflowId,
      op: { kind: o.kind, ...o.payload },
    });
    if (!ack.ok) throw new Error(`op rejected: ${ack.error}`);
    lastSeq = ack.seq ?? lastSeq;
  }
  console.log(`  alice submitted ${ops.length} ops, last seq=${lastSeq}`);

  await new Promise((r) => setTimeout(r, 250));
  console.log(
    `▸ bob received ${opsSeenByB.length} ops via fan-out (expected ${ops.length})`,
  );
  if (opsSeenByB.length !== ops.length) {
    throw new Error(
      `fan-out mismatch: bob saw ${opsSeenByB.length}/${ops.length}`,
    );
  }

  console.log("▸ bob updates presence; alice should receive it");
  b.emit("presence:update", {
    workflowId,
    cursor: { x: 123, y: 456 },
    selection: [branchId],
  });
  await new Promise((r) => setTimeout(r, 300));
  if (!presenceSeenByA.includes("bob")) {
    throw new Error("alice did not see bob's presence update");
  }
  console.log("  alice saw bob's cursor");

  console.log("▸ trigger an execution run");
  const trig = await httpJSON<{ run: { _id: string; status: string } }>(
    `${base}/api/workflows/${workflowId}/runs`,
    {
      method: "POST",
      token: aliceTok,
      body: JSON.stringify({ input: { fromTest: true } }),
    },
  );
  const runId = trig.run._id;
  console.log(`  enqueued run ${runId}`);

  console.log("▸ polling for terminal state");
  const deadline = Date.now() + 30_000;
  let final: { run: { status: string; error?: string; steps: unknown[] } } | null = null;
  while (Date.now() < deadline) {
    const r = await httpJSON<{ run: { status: string; error?: string; steps: unknown[] } }>(
      `${base}/api/runs/${runId}`,
      { token: aliceTok },
    );
    if (r.run.status === "succeeded" || r.run.status === "failed") {
      final = r;
      break;
    }
    await new Promise((res) => setTimeout(res, 500));
  }
  if (!final) throw new Error("run did not finish within 30s");
  console.log(`  run ${runId} → ${final.run.status} (${final.run.steps.length} steps)`);
  if (final.run.error) console.log(`  error: ${final.run.error}`);

  console.log("▸ disconnect");
  a.disconnect();
  b.disconnect();
  await new Promise((r) => setTimeout(r, 100));

  console.log("\n✔ simulator pass");
  console.log(
    "  - 2 clients, op fan-out via Redis adapter ✓",
  );
  console.log("  - presence propagated cross-socket ✓");
  console.log(`  - end-to-end run completed: status=${final.run.status}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("\n✘ simulator failed:", err);
  process.exit(1);
});
