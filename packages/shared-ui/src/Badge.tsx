import * as React from "react";
import { cn } from "./cn";

type Tone = "neutral" | "cyan" | "green" | "amber" | "violet" | "rose";

const tones: Record<Tone, string> = {
  neutral: "bg-white/5 text-slate-300 border-white/10",
  cyan: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  amber: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  violet: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  rose: "bg-rose-400/10 text-rose-300 border-rose-400/20",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
