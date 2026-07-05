import type { Metadata } from "next";
import { experience } from "@/data/profile";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Experience",
  description: "Roles, scope, measurable outcomes.",
};

export default function ExperiencePage() {
  return (
    <section className="section pt-24">
      <div className="container-tight">
        <SectionHeadingGradient
          eyebrow="Experience"
          title="A timeline of"
          highlight="shipping"
          subtitle="No bullet salad. Each entry is scoped to the most consequential work."
        />

        <ol className="mt-14 space-y-10 border-l border-white/10 pl-6">
          {experience.map((e) => (
            <li key={`${e.company}-${e.period}`} className="relative">
              <span className="absolute -left-[31px] top-2 h-3 w-3 rounded-full border-2 border-ink-950 bg-gradient-to-br from-cyan-400 to-violet-500" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="text-lg font-semibold text-white">{e.role}</h3>
                <span className="text-sm text-slate-400">@ {e.company}</span>
                <span className="ml-auto font-mono text-xs text-slate-500">
                  {e.period} · {e.location}
                </span>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-slate-300">
                {e.highlights.map((h) => (
                  <li key={h} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-cyan-400/70" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {e.stack.map((s) => (
                  <span
                    key={s}
                    className="rounded border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
