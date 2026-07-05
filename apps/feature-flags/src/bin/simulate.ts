import { FeatureFlagClient } from "../sdk/node.js";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:4500";

async function api(
  path: string,
  init: RequestInit = {},
  token?: string,
): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  if (token) headers.set("authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

function log(label: string, data: unknown): void {
  console.log(`\n=== ${label} ===\n${JSON.stringify(data, null, 2)}`);
}

async function main(): Promise<void> {
  const token = (
    (await api("/auth/dev-token", {
      method: "POST",
      body: JSON.stringify({ sub: "sim", role: "admin", envs: ["dev"] }),
    })) as { token: string }
  ).token;
  log("got token", { token: token.slice(0, 20) + "..." });

  const flagKey = `sim_flag_${Date.now()}`;

  await api(
    "/flags",
    {
      method: "POST",
      body: JSON.stringify({
        key: flagKey,
        type: "boolean",
        description: "simulator flag",
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
            rollout: { variant: "on", percentage: 50 },
          },
        },
        owner: "sim",
      }),
    },
    token,
  );
  log("created flag", { flagKey });

  const sdk = new FeatureFlagClient({
    baseUrl: BASE,
    env: "dev",
    authToken: token,
    onUpdate: (v) => console.log(`sdk: ruleset version ${v}`),
    onError: (e) => console.warn(`sdk error: ${e.message}`),
  });
  await sdk.start();
  await sdk.ready();
  log("sdk ready", { version: sdk.version() });

  const eval1 = sdk.evaluate(flagKey, {
    userId: "user-a",
    attrs: { role: "beta" },
  });
  log("eval beta user", eval1);

  const sampled: Array<{ user: string; reason: string; value: unknown }> = [];
  for (let i = 0; i < 200; i++) {
    const r = sdk.evaluate(flagKey, { userId: `user-${i}` });
    sampled.push({ user: `user-${i}`, reason: r.reason, value: r.value });
  }
  const counts = sampled.reduce<Record<string, number>>((acc, r) => {
    acc[r.reason] = (acc[r.reason] ?? 0) + 1;
    return acc;
  }, {});
  log("rollout distribution (200 users)", counts);

  await api(
    `/flags/${flagKey}/env/dev`,
    {
      method: "PATCH",
      body: JSON.stringify({ enabled: false }),
    },
    token,
  );
  log("flipped flag off", { flagKey });

  await new Promise((r) => setTimeout(r, 500));
  log("eval after flip", sdk.evaluate(flagKey, { userId: "user-a" }));
  log("sdk ruleset version after flip", { version: sdk.version() });

  await api(
    `/flags/${flagKey}`,
    { method: "DELETE" },
    token,
  );
  await sdk.close();
  log("done", { ok: true });
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
