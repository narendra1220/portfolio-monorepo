import { IncomingMessage, ServerResponse } from "node:http";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

export interface ForwardOptions {
  upstreamUrl: string;
  upstreamPath: string;
  method: string;
  reqHeaders: Record<string, string | string[] | undefined>;
  body: Buffer | null;
  timeoutMs: number;
  consumerId: string;
  requestId: string;
}

export interface ForwardResult {
  status: number;
  durationMs: number;
  upstream: string;
  bytes: number;
}

export function forwardAndStream(
  opts: ForwardOptions,
  clientRes: ServerResponse,
): Promise<ForwardResult> {
  return new Promise((resolve, reject) => {
    const upstreamUrl = new URL(opts.upstreamPath, normalizeBase(opts.upstreamUrl));
    const isHttps = upstreamUrl.protocol === "https:";
    const requester = isHttps ? httpsRequest : httpRequest;

    const headers: Record<string, string | string[]> = {};
    for (const [k, v] of Object.entries(opts.reqHeaders)) {
      if (v === undefined) continue;
      const lk = k.toLowerCase();
      if (HOP_BY_HOP.has(lk)) continue;
      if (lk === "host") continue;
      headers[k] = v;
    }
    headers["x-request-id"] = opts.requestId;
    headers["x-forwarded-by"] = "api-gateway";
    if (opts.consumerId) headers["x-consumer-id"] = opts.consumerId;

    const start = performance.now();
    const upstreamReq = requester(
      {
        method: opts.method,
        protocol: upstreamUrl.protocol,
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port || (isHttps ? 443 : 80),
        path: upstreamUrl.pathname + upstreamUrl.search,
        headers,
      },
      (upstreamRes: IncomingMessage) => {
        const outHeaders: Record<string, string | string[]> = {};
        for (const [k, v] of Object.entries(upstreamRes.headers)) {
          if (v === undefined) continue;
          if (HOP_BY_HOP.has(k.toLowerCase())) continue;
          outHeaders[k] = v;
        }
        outHeaders["x-request-id"] = opts.requestId;
        clientRes.writeHead(upstreamRes.statusCode ?? 502, outHeaders);
        let bytes = 0;
        upstreamRes.on("data", (chunk: Buffer) => {
          bytes += chunk.length;
        });
        upstreamRes.pipe(clientRes);
        upstreamRes.on("end", () => {
          resolve({
            status: upstreamRes.statusCode ?? 502,
            durationMs: performance.now() - start,
            upstream: opts.upstreamUrl,
            bytes,
          });
        });
        upstreamRes.on("error", reject);
      },
    );

    upstreamReq.setTimeout(opts.timeoutMs, () => {
      upstreamReq.destroy(new Error("upstream timeout"));
    });
    upstreamReq.on("error", (err) => {
      reject(err);
    });
    if (opts.body && opts.body.length > 0) {
      upstreamReq.write(opts.body);
    }
    upstreamReq.end();
  });
}

function normalizeBase(s: string): string {
  return s.endsWith("/") ? s : s + "/";
}

export function readBody(req: IncomingMessage, maxBytes = 1024 * 1024 * 4): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    req.on("data", (c: Buffer) => {
      total += c.length;
      if (total > maxBytes) {
        reject(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
