import type { Metadata } from "next";
import { projects } from "@/data/projects";
import { ProjectCard } from "@/components/ProjectCard";
import { SectionHeadingGradient } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Projects",
  description: "Six engineering case studies, each with architecture and tradeoffs.",
};

export default function ProjectsPage() {
  return (
    <section className="section pt-24">
      <div className="container-wide">
        <SectionHeadingGradient
          eyebrow="Projects"
          title="Six systems, six"
          highlight="defensible designs"
          subtitle="One is shipped code in this repo. Five are documented case studies designed at production depth — that is how portfolios honestly work."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </div>
    </section>
  );
}
