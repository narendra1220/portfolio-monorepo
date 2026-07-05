import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Badge } from "@portfolio/shared-ui";
import type { ProjectCaseStudy } from "@portfolio/shared-types";

const statusTone: Record<
  ProjectCaseStudy["status"],
  "green" | "amber" | "neutral"
> = {
  shipped: "green",
  "in-progress": "amber",
  "case-study": "neutral",
};

export function ProjectCard({ project }: { project: ProjectCaseStudy }) {
  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-6 transition-all duration-300 hover:border-cyan-400/30 hover:from-cyan-500/[0.06] hover:to-white/[0.02]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge tone={statusTone[project.status]}>{project.status}</Badge>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              inspired by {project.inspiredBy.slice(0, 2).join(" · ")}
            </span>
          </div>
          <h3 className="mt-3 text-lg font-semibold text-white">
            {project.title}
          </h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400 leading-relaxed">
            {project.tagline}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-500 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cyan-300" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        {project.metrics.slice(0, 4).map((m) => (
          <div key={m.label} className="rounded-md border border-white/5 bg-black/20 p-2.5">
            <div className="font-mono text-sm text-cyan-300">{m.value}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {project.stack.slice(0, 6).map((s) => (
          <span
            key={s}
            className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slate-400"
          >
            {s}
          </span>
        ))}
        {project.stack.length > 6 && (
          <span className="text-[10px] text-slate-500">
            +{project.stack.length - 6}
          </span>
        )}
      </div>
    </Link>
  );
}
