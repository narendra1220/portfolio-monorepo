import vm from "node:vm";
import type { NodeRunner } from "../engine.js";

export const transformNode: NodeRunner = async (ctx) => {
  const expr = String(ctx.node.props.expr ?? "");
  if (!expr) throw new Error("transform node: expr required");

  const sandbox: Record<string, unknown> = {
    input: ctx.input,
    vars: ctx.vars,
    out: undefined,
  };
  const wrapped = `out = (function(input, vars){ "use strict"; return (${expr}); })(input, vars);`;
  const script = new vm.Script(wrapped, { filename: `transform:${ctx.node.id}` });
  const context = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  script.runInContext(context, { timeout: 1000, breakOnSigint: true });

  return { output: { value: sandbox.out }, next: "default" };
};
