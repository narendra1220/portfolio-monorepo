import { RulesetIndex } from "../compiler/eval.js";
import type {
  EvalContext,
  EvalResult,
  FlagValue,
  Ruleset,
} from "../types.js";

export interface SdkOptions {
  baseUrl: string;
  env: string;
  authToken?: string;
  onUpdate?: (version: number) => void;
  onError?: (err: Error) => void;
  refreshOnStartup?: boolean;
}

export class FeatureFlagClient {
  private index: RulesetIndex | null = null;
  private controller: AbortController | null = null;
  private closed = false;
  private currentVersion = 0;
  private readyResolvers: Array<() => void> = [];

  constructor(private readonly opts: SdkOptions) {}

  async start(): Promise<void> {
    if (this.opts.refreshOnStartup !== false) {
      await this.refresh();
    }
    void this.streamLoop();
  }

  ready(): Promise<void> {
    if (this.index) return Promise.resolve();
    return new Promise((resolve) => this.readyResolvers.push(resolve));
  }

  evaluate(flag: string, context: EvalContext): EvalResult {
    if (!this.index) {
      return {
        flag,
        variant: "",
        value: false,
        reason: "flag_missing",
      };
    }
    return this.index.evaluate(flag, context);
  }

  boolean(flag: string, ctx: EvalContext, fallback = false): boolean {
    const r = this.evaluate(flag, ctx);
    return typeof r.value === "boolean" ? r.value : fallback;
  }

  string(flag: string, ctx: EvalContext, fallback = ""): string {
    const r = this.evaluate(flag, ctx);
    return typeof r.value === "string" ? r.value : fallback;
  }

  number(flag: string, ctx: EvalContext, fallback = 0): number {
    const r = this.evaluate(flag, ctx);
    return typeof r.value === "number" ? r.value : fallback;
  }

  version(): number {
    return this.currentVersion;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.controller?.abort();
  }

  private async refresh(): Promise<void> {
    const url = `${this.opts.baseUrl}/ruleset/${encodeURIComponent(this.opts.env)}/latest`;
    const res = await fetch(url, {
      headers: this.headers(),
    });
    if (res.status === 404) return;
    if (!res.ok) throw new Error(`refresh failed: ${res.status}`);
    const ruleset = (await res.json()) as Ruleset;
    this.installRuleset(ruleset);
  }

  private installRuleset(ruleset: Ruleset): void {
    if (ruleset.version <= this.currentVersion) return;
    this.index = new RulesetIndex(ruleset);
    this.currentVersion = ruleset.version;
    this.opts.onUpdate?.(ruleset.version);
    const pending = this.readyResolvers;
    this.readyResolvers = [];
    for (const fn of pending) fn();
  }

  private async streamLoop(): Promise<void> {
    let attempt = 0;
    while (!this.closed) {
      this.controller = new AbortController();
      try {
        await this.connect(this.controller.signal);
        attempt = 0;
      } catch (err) {
        if (this.closed) return;
        this.opts.onError?.(err as Error);
        const backoff = Math.min(30_000, 500 * 2 ** attempt++);
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }

  private async connect(signal: AbortSignal): Promise<void> {
    const url = `${this.opts.baseUrl}/sse/${encodeURIComponent(this.opts.env)}`;
    const res = await fetch(url, { headers: this.headers(), signal });
    if (!res.ok || !res.body) {
      throw new Error(`sse connect failed: ${res.status}`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    while (!signal.aborted) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended");
      buf += decoder.decode(value, { stream: true });
      let idx = buf.indexOf("\n\n");
      while (idx >= 0) {
        const chunk = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        await this.handleSseChunk(chunk);
        idx = buf.indexOf("\n\n");
      }
    }
  }

  private async handleSseChunk(chunk: string): Promise<void> {
    let eventName: string | null = null;
    let data: string | null = null;
    for (const line of chunk.split("\n")) {
      if (line.startsWith(":")) continue;
      if (line.startsWith("event: ")) eventName = line.slice(7).trim();
      else if (line.startsWith("data: ")) {
        data = data === null ? line.slice(6) : data + "\n" + line.slice(6);
      }
    }
    if (eventName === "ruleset" && data) {
      try {
        const evt = JSON.parse(data) as { env: string; version: number };
        if (evt.env === this.opts.env && evt.version > this.currentVersion) {
          await this.refresh();
        }
      } catch {}
    }
  }

  private headers(): Record<string, string> {
    return this.opts.authToken
      ? { authorization: `Bearer ${this.opts.authToken}` }
      : {};
  }
}

export type { FlagValue, EvalContext, EvalResult };
