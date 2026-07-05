import type { Metadata } from "next";
import Link from "next/link";
import { Clock } from "lucide-react";
import { posts } from "@/data/blog";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Blog",
  description: "Notes on backend, queues, and observability.",
};

export default function BlogPage() {
  return (
    <section className="section pt-24">
      <div className="container-tight">
        <SectionHeadingGradient
          eyebrow="Writing"
          title="Notes from the"
          highlight="control plane"
          subtitle="Short essays on the systems I actually run."
        />
        <ul className="mt-12 divide-y divide-white/5 border-y border-white/5">
          {posts.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/blog/${p.slug}`}
                className="group flex items-center justify-between gap-6 py-6 transition-colors hover:bg-white/[0.02] px-2 rounded-md"
              >
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-white group-hover:text-cyan-200">
                    {p.title}
                  </h3>
                  <p className="mt-1 text-sm text-slate-400 line-clamp-2">
                    {p.excerpt}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                    <span>{p.date}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {p.readingMinutes} min
                    </span>
                    <span className="flex gap-1.5">
                      {p.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono"
                        >
                          #{t}
                        </span>
                      ))}
                    </span>
                  </div>
                </div>
                <span className="hidden text-sm text-cyan-300 group-hover:translate-x-0.5 transition-transform sm:inline">
                  Read →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
