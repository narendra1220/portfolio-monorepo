import type { Op, WorkflowDoc } from "../types.js";

export function emptyDoc(): WorkflowDoc {
  return { nodes: {}, edges: {} };
}

export function applyOp(doc: WorkflowDoc, op: Op): WorkflowDoc {
  switch (op.kind) {
    case "node.add":
      return {
        ...doc,
        nodes: { ...doc.nodes, [op.node.id]: { ...op.node } },
      };
    case "node.move": {
      const n = doc.nodes[op.id];
      if (!n) return doc;
      return {
        ...doc,
        nodes: { ...doc.nodes, [op.id]: { ...n, x: op.x, y: op.y } },
      };
    }
    case "node.delete": {
      if (!doc.nodes[op.id]) return doc;
      const nodes = { ...doc.nodes };
      delete nodes[op.id];
      const edges: WorkflowDoc["edges"] = {};
      for (const [eid, e] of Object.entries(doc.edges)) {
        if (e.from !== op.id && e.to !== op.id) edges[eid] = e;
      }
      return { ...doc, nodes, edges };
    }
    case "node.prop": {
      const n = doc.nodes[op.id];
      if (!n) return doc;
      return {
        ...doc,
        nodes: {
          ...doc.nodes,
          [op.id]: { ...n, props: { ...n.props, [op.key]: op.value } },
        },
      };
    }
    case "edge.add": {
      if (!doc.nodes[op.edge.from] || !doc.nodes[op.edge.to]) return doc;
      return {
        ...doc,
        edges: { ...doc.edges, [op.edge.id]: { ...op.edge } },
      };
    }
    case "edge.delete": {
      if (!doc.edges[op.id]) return doc;
      const edges = { ...doc.edges };
      delete edges[op.id];
      return { ...doc, edges };
    }
    default: {
      const _exhaustive: never = op;
      return _exhaustive;
    }
  }
}

export function materialize(
  base: WorkflowDoc,
  ops: Iterable<Op>,
): WorkflowDoc {
  let doc = base;
  for (const op of ops) doc = applyOp(doc, op);
  return doc;
}
