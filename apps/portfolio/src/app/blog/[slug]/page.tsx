import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { posts } from "@/data/blog";

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const p = posts.find((x) => x.slug === slug);
  if (!p) return { title: "Not found" };
  return { title: p.title, description: p.excerpt };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();
  return (
    <article className="section pt-24">
      <div className="container-tight max-w-3xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All posts
        </Link>
        <header className="mt-6">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {post.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>{post.date}</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {post.readingMinutes} min
            </span>
            <span className="flex gap-1.5">
              {post.tags.map((t) => (
                <span
                  key={t}
                  className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono"
                >
                  #{t}
                </span>
              ))}
            </span>
          </div>
        </header>
        <div className="prose-invert-tight mt-10 whitespace-pre-line text-base">
          {post.body}
        </div>
      </div>
    </article>
  );
}
