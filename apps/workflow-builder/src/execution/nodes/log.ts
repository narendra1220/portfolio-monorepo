import type { NodeRunner } from "../engine.js";

export const logNode: NodeRunner = async (ctx) => {
  const message = String(ctx.node.props.message ?? "(no message)");
  const rendered = ctx.render(message);
  ctx.log(`log: ${rendered}`);
  return { output: { message: rendered }, next: "default" };
};
