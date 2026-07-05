"use client";

import Link from "next/link";
import { ExternalLink, Monitor } from "lucide-react";
import { Button } from "@portfolio/shared-ui";

export function ProjectDemoEmbed({
  src,
  title,
  backendPort,
}: {
  src: string;
  title: string;
  backendPort?: number;
}) {
  return (
    <section id="demo" className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Monitor className="h-4 w-4 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Live demo</h2>
        </div>
        <Link href={src} target="_blank" rel="noreferrer">
          <Button variant="secondary" size="sm">
            <ExternalLink className="h-3.5 w-3.5" />
            Open full screen
          </Button>
        </Link>
      </div>

      {backendPort && (
        <p className="mb-3 text-xs text-slate-500">
          Requires the API on port {backendPort}. Start with{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-slate-400">
            node dist/bin/server.js
          </code>{" "}
          in the matching <code className="font-mono">apps/</code> folder.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-950 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-2 border-b border-white/5 bg-white/[0.02] px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <span className="ml-2 truncate font-mono text-[10px] text-slate-500">
            {src}
          </span>
        </div>
        <iframe
          src={src}
          title={`${title} live demo`}
          className="w-full border-0 bg-ink-950"
          style={{ height: "min(72vh, 820px)", minHeight: "520px" }}
          loading="lazy"
        />
      </div>
    </section>
  );
}

/** Map project slugs to backend ports for the embed hint banner. */
export const demoBackendPorts: Record<string, number> = {
  "developer-portal": 4600,
  "feature-flag-platform": 4500,
};
