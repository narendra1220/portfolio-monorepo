"use client";

export function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 text-xs font-mono text-slate-300 leading-relaxed max-h-[420px] overflow-y-auto">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export function StatusPill({
  status,
}: {
  status: "up" | "down" | "degraded" | "unknown" | string;
}) {
  const colors: Record<string, string> = {
    up: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    down: "bg-rose-400/15 text-rose-300 border-rose-400/30",
    degraded: "bg-amber-400/15 text-amber-300 border-amber-400/30",
    unknown: "bg-slate-400/15 text-slate-300 border-slate-400/30",
    enabled: "bg-emerald-400/15 text-emerald-300 border-emerald-400/30",
    disabled: "bg-slate-400/15 text-slate-400 border-slate-400/30",
  };
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium ${
        colors[status] ?? colors.unknown
      }`}
    >
      {status}
    </span>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5">
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 ${props.className ?? ""}`}
    />
  );
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-mono text-slate-100 placeholder:text-slate-600 focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 ${props.className ?? ""}`}
    />
  );
}

export function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400/40 focus:outline-none ${props.className ?? ""}`}
    />
  );
}
