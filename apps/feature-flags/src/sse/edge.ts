import type { Request, Response } from "express";
import type { Redis } from "ioredis";
import { RULESET_CHANNEL } from "../config.js";
import type { RulesetPublisher } from "../bus/publisher.js";

export interface EdgeDeps {
  publisher: RulesetPublisher;
  redisFactory: () => Redis;
}

export function mountSSE(
  app: import("express").Express,
  deps: EdgeDeps,
): void {
  app.get("/sse/:env", async (req: Request, res: Response) => {
    const env = String(req.params.env);
    res.set({
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(`retry: 2000\n\n`);

    const latest = await deps.publisher.fetchLatest(env);
    if (latest) {
      res.write(
        `event: ruleset\ndata: ${JSON.stringify({ env: latest.env, version: latest.version })}\n\n`,
      );
    }

    const sub = deps.redisFactory();
    await sub.subscribe(RULESET_CHANNEL);
    sub.on("message", (_ch: string, msg: string) => {
      try {
        const evt = JSON.parse(msg);
        if (evt.env !== env) return;
        res.write(`event: ruleset\ndata: ${msg}\n\n`);
      } catch {}
    });

    const heartbeat = setInterval(() => {
      res.write(`:keepalive ${Date.now()}\n\n`);
    }, 15_000);

    const close = () => {
      clearInterval(heartbeat);
      sub.disconnect();
      res.end();
    };
    req.on("close", close);
    req.on("aborted", close);
  });

  app.get("/ruleset/:env/latest", async (req, res) => {
    const env = String(req.params.env);
    const ruleset = await deps.publisher.fetchLatest(env);
    if (!ruleset) return res.status(404).json({ error: "no_ruleset" });
    res.json(ruleset);
  });

  app.get("/ruleset/:env/:version", async (req, res) => {
    const ruleset = await deps.publisher.fetch(
      String(req.params.env),
      Number(req.params.version),
    );
    if (!ruleset) return res.status(404).json({ error: "not_found" });
    res.json(ruleset);
  });
}
