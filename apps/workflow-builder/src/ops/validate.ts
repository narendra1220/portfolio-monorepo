import { z } from "zod";
import type { Op } from "../types.js";

const nodeKind = z.enum(["http", "transform", "branch", "log", "start"]);

const nodeSchema = z.object({
  id: z.string().min(1),
  kind: nodeKind,
  x: z.number().finite(),
  y: z.number().finite(),
  props: z.record(z.unknown()),
});

const edgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  branch: z.enum(["true", "false", "default"]).optional(),
});

const base = z.object({ actor: z.string().min(1) });

export const opSchema: z.ZodType<Op> = z.union([
  base.extend({ kind: z.literal("node.add"), node: nodeSchema }),
  base.extend({
    kind: z.literal("node.move"),
    id: z.string().min(1),
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  base.extend({ kind: z.literal("node.delete"), id: z.string().min(1) }),
  base.extend({
    kind: z.literal("node.prop"),
    id: z.string().min(1),
    key: z.string().min(1).max(64),
    value: z.unknown(),
  }),
  base.extend({ kind: z.literal("edge.add"), edge: edgeSchema }),
  base.extend({ kind: z.literal("edge.delete"), id: z.string().min(1) }),
]) as z.ZodType<Op>;

export function parseOp(raw: unknown, actor: string): Op {
  const obj =
    raw && typeof raw === "object" ? { ...(raw as object), actor } : { actor };
  return opSchema.parse(obj);
}
