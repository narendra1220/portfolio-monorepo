import type { ProjectCaseStudy } from "@portfolio/shared-types";
import { jobQueue } from "./job-queue";
import { workflowBuilder } from "./workflow-builder";
import { apiGateway } from "./api-gateway";
import { observabilityPlatform } from "./observability-platform";
import { featureFlags } from "./feature-flags";
import { developerPortal } from "./developer-portal";

export const projects: ProjectCaseStudy[] = [
  jobQueue,
  workflowBuilder,
  apiGateway,
  observabilityPlatform,
  featureFlags,
  developerPortal,
];

export const projectsBySlug: Record<string, ProjectCaseStudy> = Object.fromEntries(
  projects.map((p) => [p.slug, p]),
);
