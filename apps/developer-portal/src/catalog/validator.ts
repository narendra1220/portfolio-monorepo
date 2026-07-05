import { z } from "zod";
import type { ServiceManifest } from "../types.js";

const ownerSchema = z.object({
  team: z.string().min(1),
  contact: z.string().min(1),
  slack: z.string().optional(),
});

const linksSchema = z
  .object({
    repo: z.string().url().optional(),
    runbook: z.string().url().optional(),
    docs: z.string().url().optional(),
    dashboard: z.string().url().optional(),
  })
  .optional();

export const manifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9._-]+$/i),
  name: z.string().min(1),
  description: z.string().min(1).max(2000),
  owner: ownerSchema,
  tier: z.enum(["tier-0", "tier-1", "tier-2", "tier-3"]),
  lifecycle: z.enum(["experimental", "beta", "ga", "deprecated", "sunset"]),
  baseUrl: z.string().url(),
  healthUrl: z.string().url(),
  openapiUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  links: linksSchema,
  dependencies: z.array(z.string()).optional(),
});

export function parseManifest(input: unknown): ServiceManifest {
  return manifestSchema.parse(input);
}

export function safeParseManifest(input: unknown):
  | { ok: true; manifest: ServiceManifest }
  | { ok: false; errors: z.ZodIssue[] } {
  const r = manifestSchema.safeParse(input);
  if (!r.success) return { ok: false, errors: r.error.issues };
  return { ok: true, manifest: r.data };
}
