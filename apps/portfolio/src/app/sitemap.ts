import type { MetadataRoute } from "next";
import { projects } from "@/data/projects";
import { posts } from "@/data/blog";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://narendra.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = [
    "",
    "/about",
    "/projects",
    "/demos",
    "/demos/developer-portal",
    "/demos/feature-flags",
    "/experience",
    "/skills",
    "/architecture",
    "/blog",
    "/contact",
  ].map((p) => ({
    url: `${SITE}${p}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.8,
  }));

  const projectUrls = projects.map((p) => ({
    url: `${SITE}/projects/${p.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const postUrls = posts.map((p) => ({
    url: `${SITE}/blog/${p.slug}`,
    lastModified: new Date(p.date),
    changeFrequency: "yearly" as const,
    priority: 0.6,
  }));

  return [...base, ...projectUrls, ...postUrls];
}
