import type { Metadata } from "next";
import Link from "next/link";
import { Flag, Server, ArrowRight } from "lucide-react";
import { Card, CardBody, Badge } from "@portfolio/shared-ui";

export const metadata: Metadata = {
  title: "Live Demos",
  description: "Interactive UIs wired to real backend services.",
};

const demos = [
  {
    href: "/demos/developer-portal",
    title: "Developer Portal",
    icon: Server,
    port: 4600,
    description:
      "Service catalog with search, health roll-up, OpenAPI viewer, manifest registration, and API playground proxy.",
    stack: ["Express", "MongoDB", "Redis"],
  },
  {
    href: "/demos/feature-flags",
    title: "Feature Flags",
    icon: Flag,
    port: 4500,
    description:
      "Flag admin with targeting rules, rollout slider, live eval playground, and SSE ruleset version indicator.",
    stack: ["Express", "MongoDB", "Redis", "SSE"],
  },
];

export default function DemosIndexPage() {
  return (
    <section className="section pt-24">
      <div className="container-wide">
        <h1 className="text-3xl font-semibold text-white">Live demos</h1>
        <p className="mt-3 max-w-2xl text-slate-400">
          Phase 1 frontends wired to the real backends. Start the API on the
          listed port, then use the UI — requests go through Next.js rewrites to
          localhost.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {demos.map((d) => {
            const Icon = d.icon;
            return (
              <Link key={d.href} href={d.href} className="group">
                <Card className="h-full transition-colors group-hover:border-cyan-400/30">
                  <CardBody className="p-6">
                    <div className="flex items-start justify-between">
                      <span className="rounded-lg border border-white/10 bg-cyan-400/10 p-2.5 text-cyan-300">
                        <Icon className="h-5 w-5" />
                      </span>
                      <Badge tone="neutral">:{d.port}</Badge>
                    </div>
                    <h2 className="mt-4 text-lg font-semibold text-white group-hover:text-cyan-200">
                      {d.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                      {d.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {d.stack.map((s) => (
                        <Badge key={s} tone="violet">{s}</Badge>
                      ))}
                    </div>
                    <span className="mt-5 inline-flex items-center gap-1 text-sm text-cyan-400">
                      Open demo <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
