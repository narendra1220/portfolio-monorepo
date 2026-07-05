import type { Metadata } from "next";
import { profile, education } from "@/data/profile";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "About",
  description: "About me, how I work, and what I optimize for.",
};

export default function AboutPage() {
  return (
    <section className="section pt-24">
      <div className="container-tight">
        <SectionHeadingGradient
          eyebrow="About"
          title="Engineer first."
          highlight="Boring infra is a feature."
          subtitle={profile.summary}
        />

        <div className="mt-12 grid gap-10 md:grid-cols-[2fr_1fr]">
          <article className="prose-invert-tight">
            <h2>How I work</h2>
            <p>
              I build backend systems that have to stay up under real traffic —
              APIs, integrations, caching, observability, and the reliability
              primitives around them. I also ship the UI when a project needs
              one: admin dashboards, portals, and live demos that prove the
              backend works end-to-end.
            </p>
            <h3>Things I&apos;m good at</h3>
            <ul>
              <li>Designing for failure: idempotency, retries, dead-letter, timeouts as first-class.</li>
              <li>Reading other people&apos;s production stacks and explaining what they actually do.</li>
              <li>Drawing a defensible architecture in a meeting and shipping it that quarter.</li>
              <li>Saying &ldquo;no, that won&apos;t scale, and here&apos;s the back-of-envelope&rdquo; without bikeshedding.</li>
            </ul>
            <h3>Things I&apos;m deliberately not</h3>
            <ul>
              <li>An ML engineer. I integrate models; I don&apos;t train them.</li>
              <li>A pixel-perfect designer. I ship clean UI; I don&apos;t pretend it&apos;s craft.</li>
              <li>A &ldquo;ten years of every framework&rdquo; resumé. The tools change. The fundamentals don&apos;t.</li>
            </ul>
            <h3>What I look for in a role</h3>
            <ul>
              <li>Real distributed-systems problems and the autonomy to solve them end-to-end.</li>
              <li>Teams that ship docs alongside services.</li>
              <li>Engineering leadership that treats production incidents as data, not blame.</li>
            </ul>
          </article>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Quick facts
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                {[
                  ["Location", profile.location],
                  ["Email", profile.email],
                  ["Phone", profile.phone],
                  ["Role", profile.role],
                  ["Status", profile.available ? "Open to roles" : "Heads down"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                    <dt className="text-slate-500">{k}</dt>
                    <dd className="font-mono text-slate-200">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="text-xs uppercase tracking-wider text-slate-500">
                Education
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="font-medium text-slate-200">{education.degree}</dt>
                  <dd className="text-slate-400">{education.school}</dd>
                </div>
                <div className="flex justify-between gap-3 border-t border-white/5 pt-2">
                  <dt className="text-slate-500">Period</dt>
                  <dd className="font-mono text-slate-300">{education.period}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">GPA</dt>
                  <dd className="font-mono text-slate-300">{education.gpa}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500">Location</dt>
                  <dd className="font-mono text-slate-300">{education.location}</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}
