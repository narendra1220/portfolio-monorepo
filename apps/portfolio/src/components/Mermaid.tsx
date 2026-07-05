export function MermaidBlock({ source }: { source: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
        <span>diagram</span>
        <span>mermaid · render-on-demand</span>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap text-[11px] leading-relaxed text-slate-300 font-mono">
        {source}
      </pre>
    </div>
  );
}
