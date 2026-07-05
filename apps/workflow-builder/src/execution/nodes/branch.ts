import vm from "node:vm";
import type { NodeRunner } from "../engine.js";

export const branchNode: NodeRunner = async (ctx) => {
  const expr = String(ctx.node.props.condition ?? "false");
  const sandbox: Record<string, unknown> = {
    input: ctx.input,
    vars: ctx.vars,
    out: false,
  };
  const script = new vm.Script(
    `out = !!(function(input, vars){ "use strict"; return (${expr}); })(input, vars);`,
    { filename: `branch:${ctx.node.id}` },
  );
  const context = vm.createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
  });
  script.runInContext(context, { timeout: 200 });

  const taken = sandbox.out ? "true" : "false";
  ctx.log(`branch ${expr} → ${taken}`);
  return { output: { taken }, next: taken };
};
