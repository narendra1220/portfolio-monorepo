import type { Metadata } from "next";
import { skills, techRadar } from "@/data/profile";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Skills",
  description: "Languages, runtimes, datastores, and the tech radar.",
};

const levelTone: Record<string, string> = {
  core: "bg-cyan-400/80 text-slate-950 border-cyan-300",
  strong: "bg-cyan-400/20 text-cyan-200 border-cyan-400/30",
  working: "bg-white/5 text-slate-300 border-white/10",
};

const ringTone: Record<string, string> = {
  Adopt: "border-emerald-400/40 text-emerald-300",
  Trial: "border-cyan-400/40 text-cyan-300",
  Assess: "border-amber-400/40 text-amber-300",
  Hold: "border-rose-400/40 text-rose-300",
};

export default function SkillsPage() {
  return (
    <section className="section pt-24">
      <div className="container-wide">
        <SectionHeadingGradient
          eyebrow="Skills"
          title="What I reach for,"
          highlight="ranked honestly"
          subtitle="Core: I would defend the choice. Strong: production-proven. Working: enough to ship."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((group) => (
            <div
              key={group.category}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                {group.category}
              </h3>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {group.items.map((s) => (
                  <span
                    key={s.name}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium ${levelTone[s.level]}`}
                    title={`level: ${s.level}`}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20">
          <SectionHeadingGradient
            eyebrow="Tech radar"
            title="Adopt,"
            highlight="trial, assess, hold"
            subtitle="A snapshot of what I'm running toward, what I'm wary of, and what I'm done with."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {techRadar.map((ring) => (
              <div
                key={ring.ring}
                className={`rounded-2xl border ${ringTone[ring.ring]} bg-black/30 p-5`}
              >
                <div className="text-xs font-semibold uppercase tracking-wider">
                  {ring.ring}
                </div>
                <ul className="mt-4 space-y-1 text-sm text-slate-300">
                  {ring.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
