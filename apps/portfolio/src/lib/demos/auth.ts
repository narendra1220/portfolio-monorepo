const tokenCache = new Map<string, { token: string; exp: number }>();

export async function getDemoToken(
  service: "devportal" | "flags",
  role: "admin" | "editor" | "viewer" = "admin",
): Promise<string> {
  const key = `${service}:${role}`;
  const cached = tokenCache.get(key);
  if (cached && cached.exp > Date.now()) return cached.token;

  const base =
    service === "devportal"
      ? "/api/demos/devportal"
      : "/api/demos/flags";

  const res = await fetch(`${base}/auth/dev-token`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sub: "portfolio-ui", role }),
  });
  if (!res.ok) throw new Error(`auth failed: ${res.status}`);
  const data = (await res.json()) as { token: string };
  tokenCache.set(key, { token: data.token, exp: Date.now() + 11 * 60 * 60 * 1000 });
  return data.token;
}
