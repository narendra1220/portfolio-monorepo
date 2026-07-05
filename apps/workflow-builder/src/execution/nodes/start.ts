import type { NodeRunner } from "../engine.js";

export const startNode: NodeRunner = async (ctx) => {
  return { output: { input: ctx.input }, next: "default" };
};
