"use client";

import { useEffect, useState } from "react";

const lines = [
  { kind: "prompt", text: "redis-cli FLUSHDB" },
  { kind: "out", text: "OK" },
  { kind: "prompt", text: "node dist/examples/producer.js 20" },
  { kind: "out", text: "enqueued 01KVZ... (waiting) ×20" },
  { kind: "prompt", text: "node dist/examples/consumer.js" },
  {
    kind: "out",
    text: "worker KI01100-... running on queue 'default'",
  },
  { kind: "out", text: "[metrics] completed=18 retried=2 dead=0 p95=747ms" },
  { kind: "prompt", text: "node dist/cli.js stats default" },
  {
    kind: "out",
    text: '{ "counts": { "waiting": 0, "delayed": 0, "dlq": 1, "pending": 0 } }',
  },
] as const;

export function TerminalHero() {
  const [shown, setShown] = useState(0);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (shown >= lines.length) return;
    const t = setTimeout(
      () => setShown((s) => s + 1),
      shown === 0 ? 350 : 550,
    );
    return () => clearTimeout(t);
  }, [shown]);

  useEffect(() => {
    const t = setInterval(() => setCursor((c) => !c), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="glass overflow-hidden rounded-xl text-xs font-mono shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.02] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
        <span className="ml-3 text-[10px] tracking-wider text-slate-500">
          ~ / portfolio / job-queue
        </span>
      </div>
      <div className="space-y-1 p-4 text-slate-300 min-h-[260px]">
        {lines.slice(0, shown).map((l, i) => (
          <div key={i} className="flex gap-2 leading-relaxed">
            {l.kind === "prompt" ? (
              <>
                <span className="text-cyan-400">$</span>
                <span className="text-slate-100">{l.text}</span>
              </>
            ) : (
              <span className="text-slate-400">{l.text}</span>
            )}
          </div>
        ))}
        {shown < lines.length && (
          <div className="flex gap-2 leading-relaxed">
            <span className="text-cyan-400">$</span>
            <span className="text-slate-100">{cursor ? "▍" : " "}</span>
          </div>
        )}
      </div>
    </div>
  );
}
