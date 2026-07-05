import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  Layers,
  ShieldCheck,
  Rocket,
  Wrench,
  Server,
  Boxes,
  Sparkles,
  Github,
  BookOpen,
} from "lucide-react";
import { Badge, Button } from "@portfolio/shared-ui";
import { projects, projectsBySlug } from "@/data/projects";
import { MermaidBlock } from "@/components/Mermaid";
import { ProjectDemoEmbed, demoBackendPorts } from "@/components/ProjectDemoEmbed";

export function generateStaticParams() {
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = projectsBySlug[slug];
  if (!p) return { title: "Not found" };
  return {
    title: p.title,
    description: p.tagline,
    openGraph: {
      title: p.title,
      description: p.tagline,
      type: "article",
    },
  };
}

const linkIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  github: Github,
  docs: BookOpen,
  demo: Rocket,
  blog: BookOpen,
};

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const p = projectsBySlug[slug];
  if (!p) notFound();

  const demoLink = p.links.find((l) => l.kind === "demo");

  return (
    <article className="section pt-24">
      <div className="container-tight">
        <Link
          href="/projects"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All projects
        </Link>

        <header className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              tone={
                p.status === "shipped"
                  ? "green"
                  : p.status === "in-progress"
                    ? "amber"
                    : "neutral"
              }
            >
              {p.status}
            </Badge>
            <span className="text-[10px] uppercase tracking-wider text-slate-500">
              inspired by {p.inspiredBy.join(" · ")}
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
            {p.title}
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-slate-400 leading-relaxed">
            {p.tagline}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {p.stack.map((s) => (
              <span
                key={s}
                className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300"
              >
                {s}
              </span>
            ))}
          </div>

          {p.links.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {p.links.map((l) => {
                const Icon = linkIcon[l.kind] ?? ArrowUpRight;
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    target={l.href.startsWith("http") ? "_blank" : undefined}
                    rel="noreferrer"
                  >
                    <Button variant="outline" size="sm">
                      <Icon className="h-3.5 w-3.5" />
                      {l.label}
                    </Button>
                  </a>
                );
              })}
            </div>
          )}
        </header>

        {demoLink && (
          <ProjectDemoEmbed
            src={demoLink.href}
            title={p.title}
            backendPort={demoBackendPorts[p.slug]}
          />
        )}

        <section id="metrics" className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {p.metrics.map((m) => (
            <div key={m.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <div className="font-mono text-lg text-cyan-300">{m.value}</div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">
                {m.label}
              </div>
              {m.hint && (
                <div className="mt-1 text-[11px] text-slate-500">{m.hint}</div>
              )}
            </div>
          ))}
        </section>

        <section id="readme" className="mt-16 grid gap-12 lg:grid-cols-[1fr_220px]">
          <div className="prose-invert-tight">
            <h2 className="!mt-0 flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-300" /> Overview
            </h2>
            <p>{p.overview}</p>

            <h2>Problem</h2>
            <p>{p.problem}</p>

            <h2>Architecture</h2>
            <p>{p.architecture.summary}</p>
            <div className="not-prose my-6">
              <MermaidBlock source={p.architecture.mermaid} />
            </div>

            <h3>Components</h3>
            <ul className="!list-none !pl-0 space-y-2">
              {p.architecture.components.map((c) => (
                <li
                  key={c.name}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-3"
                >
                  <div className="font-mono text-sm text-cyan-200">{c.name}</div>
                  <div className="mt-1 text-sm text-slate-400">{c.purpose}</div>
                </li>
              ))}
            </ul>

            <h2 className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-cyan-300" /> Tradeoffs
            </h2>
            <ul className="!list-none !pl-0 space-y-3">
              {p.tradeoffs.map((t) => (
                <li
                  key={t.decision}
                  className="rounded-lg border border-white/5 bg-white/[0.02] p-4"
                >
                  <div className="text-sm font-semibold text-white">
                    {t.decision}
                  </div>
                  <p className="mt-1 text-sm text-slate-300">{t.rationale}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    <span className="text-slate-400">Alternative considered:</span>{" "}
                    {t.alternative}
                  </p>
                </li>
              ))}
            </ul>

            <h2 className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-cyan-300" /> Lessons learned
            </h2>
            <ul>
              {p.lessons.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>

            <h2 className="flex items-center gap-2">
              <Server className="h-4 w-4 text-cyan-300" /> API
            </h2>
            <div className="not-prose overflow-hidden rounded-xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Path</th>
                    <th className="px-3 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {p.api.map((a) => (
                    <tr
                      key={`${a.method}-${a.path}`}
                      className="border-t border-white/5 align-top"
                    >
                      <td className="whitespace-nowrap px-3 py-2 font-mono text-cyan-300">
                        {a.method}
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-200">
                        {a.path}
                      </td>
                      <td className="px-3 py-2 text-slate-400">
                        {a.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="flex items-center gap-2">
              <Boxes className="h-4 w-4 text-cyan-300" /> Data model
            </h2>
            <div className="not-prose space-y-4">
              {p.schema.map((s) => (
                <div
                  key={s.collection}
                  className="overflow-hidden rounded-xl border border-white/10"
                >
                  <div className="border-b border-white/5 bg-white/[0.03] px-3 py-2 font-mono text-xs text-cyan-200">
                    {s.collection}
                  </div>
                  <table className="w-full text-left text-xs">
                    <tbody>
                      {s.fields.map((f) => (
                        <tr
                          key={f.name}
                          className="border-t border-white/5 align-top"
                        >
                          <td className="w-40 px-3 py-2 font-mono text-slate-200">
                            {f.name}
                          </td>
                          <td className="w-40 px-3 py-2 font-mono text-slate-500">
                            {f.type}
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {f.note ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {p.folderStructure && (
              <>
                <h2>Folder structure</h2>
                <pre>{p.folderStructure}</pre>
              </>
            )}

            <h2>Deployment</h2>
            <p>{p.deployment}</p>

            <h2 className="flex items-center gap-2">
              <Rocket className="h-4 w-4 text-cyan-300" /> Scalability
            </h2>
            <ul>
              {p.scalability.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>

            <h2 className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-cyan-300" /> Security
            </h2>
            <ul>
              {p.security.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>

            <h2 className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-cyan-300" /> Future
              improvements
            </h2>
            <ul>
              {p.future.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>

          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1 text-xs text-slate-400">
              <div className="mb-3 text-[10px] uppercase tracking-wider text-slate-500">
                On this page
              </div>
              {[
                ...(demoLink ? [["#demo", "Live demo"] as const] : []),
                ["#metrics", "Metrics"],
                ["#readme", "Overview"],
                ["#readme", "Problem"],
                ["#readme", "Architecture"],
                ["#readme", "Tradeoffs"],
                ["#readme", "Lessons"],
                ["#readme", "API"],
                ["#readme", "Data model"],
                ["#readme", "Deployment"],
                ["#readme", "Scalability"],
                ["#readme", "Security"],
                ["#readme", "Future"],
              ].map(([href, label]) => (
                <a
                  key={label}
                  href={href}
                  className="block rounded px-2 py-1 hover:bg-white/5 hover:text-slate-200"
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>
        </section>
      </div>
    </article>
  );
}
