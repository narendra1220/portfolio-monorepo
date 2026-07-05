import type { NodeRunner } from "../engine.js";

export const httpNode: NodeRunner = async (ctx) => {
  const url = String(ctx.node.props.url ?? "");
  const method = String(ctx.node.props.method ?? "GET").toUpperCase();
  if (!url) throw new Error("http node: url required");

  const renderedUrl = ctx.render(url);
  const body =
    ctx.node.props.body !== undefined
      ? typeof ctx.node.props.body === "string"
        ? ctx.render(ctx.node.props.body)
        : JSON.stringify(ctx.node.props.body)
      : undefined;
  const headers: Record<string, string> = {
    "user-agent": "workflow-builder/1.0",
    ...(body ? { "content-type": "application/json" } : {}),
    ...((ctx.node.props.headers as Record<string, string>) ?? {}),
  };

  const controller = new AbortController();
  const timeoutMs = Number(ctx.node.props.timeoutMs ?? 10_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(renderedUrl, {
      method,
      headers,
      body: body ?? null,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await res.json().catch(() => null)
    : (await res.text()).slice(0, 8192);

  ctx.log(`http ${method} ${renderedUrl} → ${res.status}`);

  return {
    output: { status: res.status, ok: res.ok, body: payload },
    next: res.ok ? "default" : "false",
  };
};
