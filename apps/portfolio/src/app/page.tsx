import Link from "next/link";
import { ArrowRight, Activity, Layers, Cpu, Database } from "lucide-react";
import { Button, Badge, GradientText } from "@portfolio/shared-ui";
import { profile } from "@/data/profile";
import { projects } from "@/data/projects";
import { TerminalHero } from "@/components/TerminalHero";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export default function HomePage() {
  return (
    <>
      <section className="section pt-24">
        <div className="container-wide grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="animate-fade-up">
            <Badge tone="cyan" className="mb-5">
              <span className="relative mr-1.5 inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300/70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cyan-400" />
              </span>
              {profile.available ? "Available for work" : "Heads down"}
            </Badge>
            <h1 className="text-balance text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
              I build the parts of the system that have to{" "}
              <GradientText>keep working</GradientText> when nothing else does.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
              I&apos;m {profile.name.split(" ")[0]}, a backend-heavy full-stack
              engineer at Kore.AI. I build distributed systems — queues, gateways,
              observability, feature flags — and the UIs that make them usable.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/projects">
                <Button size="lg">
                  See the work <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/demos">
                <Button size="lg" variant="outline">
                  Live demos
                </Button>
              </Link>
              <Link href="/about">
                <Button size="lg" variant="secondary">
                  About me
                </Button>
              </Link>
              <a href={profile.resumeUrl} download>
                <Button size="lg" variant="ghost">
                  Download résumé
                </Button>
              </a>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {profile.metrics.map((m) => (
                <div key={m.label} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <dd className="font-mono text-xl text-cyan-300">{m.value}</dd>
                  <dt className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                    {m.label}
                  </dt>
                </div>
              ))}
            </dl>
          </div>
          <div className="animate-fade-up [animation-delay:120ms]">
            <TerminalHero />
            <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                live demo
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                real Redis
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                tsc + node dist/
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <SectionHeadingGradient
            eyebrow="Selected work"
            title="Six systems,"
            highlight="six explanations"
            subtitle="Each project is a case study, not a screenshot. Problem statement, architecture, tradeoffs I'd defend in an interview."
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </div>
          <div className="mt-10 flex justify-center">
            <Link href="/projects" className="text-sm text-cyan-300 hover:text-cyan-200">
              All projects →
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container-wide grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Cpu,
              title: "Distributed systems",
              desc: "Queues, gateways, sagas, idempotency, exactly-once-as-engineers-actually-mean-it.",
            },
            {
              icon: Database,
              title: "Data systems",
              desc: "MongoDB and Postgres for sharp edges; ClickHouse for the column-oriented stuff.",
            },
            {
              icon: Activity,
              title: "Observability",
              desc: "OpenTelemetry end-to-end. SLOs, error budgets, real alerts that don't page noise.",
            },
            {
              icon: Layers,
              title: "Platform work",
              desc: "Internal frameworks that let product teams move without breaking ops.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
            >
              <Icon className="h-5 w-5 text-cyan-300" />
              <div className="mt-4 text-sm font-medium text-white">{title}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">
                {desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="container-wide">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/5 via-transparent to-violet-500/5 p-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Hiring a backend engineer who has done this before?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-400">
              I&apos;m open to senior and staff roles focused on distributed
              backends, platform, and reliability.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link href="/contact">
                <Button size="lg">Get in touch</Button>
              </Link>
              <a href={profile.resumeUrl} download>
                <Button size="lg" variant="secondary">
                  Download résumé
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
