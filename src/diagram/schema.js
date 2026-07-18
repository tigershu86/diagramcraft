const DIAGRAM_KINDS = new Set(["architecture", "flowchart"]);

const NODE_PRESETS = {
  terminal: { width: 140, height: 44, shape: "terminal" },
  process: { width: 180, height: 48, shape: "rect" },
  decision: { width: 150, height: 76, shape: "decision" },
  data: { width: 180, height: 48, shape: "data" },
  sub: { width: 180, height: 48, shape: "subprocess" },
  state: { width: 180, height: 48, shape: "rect" },
  highlight: { width: 180, height: 48, shape: "rect" },
  error: { width: 160, height: 48, shape: "rect" },
  database: { width: 152, height: 72, shape: "database" },
  external: { width: 152, height: 60, shape: "dashed-rect" },
};

const DEFAULT_NODE = { width: 152, height: 60, shape: "rect" };

function issue(code, path, message) {
  return { code, path, message };
}

export function validateDiagram(diagram) {
  const issues = [];

  if (!diagram || typeof diagram !== "object" || Array.isArray(diagram)) {
    return [issue("invalid-diagram", "$", "Diagram must be an object")];
  }

  if (!DIAGRAM_KINDS.has(diagram.kind)) {
    issues.push(issue("invalid-kind", "kind", "kind must be architecture or flowchart"));
  }
  if (!Number.isFinite(diagram.width) || diagram.width <= 0) {
    issues.push(issue("invalid-width", "width", "width must be a positive number"));
  }
  if (!Number.isFinite(diagram.height) || diagram.height <= 0) {
    issues.push(issue("invalid-height", "height", "height must be a positive number"));
  }

  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
  if (!Array.isArray(diagram.nodes)) {
    issues.push(issue("invalid-nodes", "nodes", "nodes must be an array"));
  }
  const ids = new Set();
  nodes.forEach((node, index) => {
    const nodePath = `nodes[${index}]`;
    if (!node || typeof node !== "object") {
      issues.push(issue("invalid-node", nodePath, "node must be an object"));
      return;
    }
    if (typeof node.id !== "string" || node.id.length === 0) {
      issues.push(issue("invalid-node-id", `${nodePath}.id`, "node id must be a non-empty string"));
    } else if (ids.has(node.id)) {
      issues.push(issue("duplicate-node-id", `${nodePath}.id`, `duplicate node id: ${node.id}`));
    } else {
      ids.add(node.id);
    }
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      issues.push(issue("invalid-node-position", nodePath, "node x and y must be finite numbers"));
    }
  });

  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
  if (!Array.isArray(diagram.edges)) {
    issues.push(issue("invalid-edges", "edges", "edges must be an array"));
  }
  edges.forEach((edge, index) => {
    const edgePath = `edges[${index}]`;
    if (!edge || typeof edge !== "object") {
      issues.push(issue("invalid-edge", edgePath, "edge must be an object"));
      return;
    }
    if (!ids.has(edge.from)) {
      issues.push(issue("missing-edge-source", `${edgePath}.from`, `missing edge source: ${edge.from}`));
    }
    if (!ids.has(edge.to)) {
      issues.push(issue("missing-edge-target", `${edgePath}.to`, `missing edge target: ${edge.to}`));
    }
  });

  return issues;
}

export function assertDiagram(diagram) {
  const issues = validateDiagram(diagram);
  if (issues.length > 0) {
    const details = issues.map(({ code, path, message }) => `${code} at ${path}: ${message}`).join("\n");
    throw new TypeError(`Invalid diagram:\n${details}`);
  }
  return diagram;
}

export function normalizeDiagram(diagram) {
  assertDiagram(diagram);
  return {
    subtitle: "",
    tiers: [],
    legend: [],
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const preset = NODE_PRESETS[node.type] || DEFAULT_NODE;
      return {
        sublabel: "",
        ...preset,
        ...diagram.nodeDefaults,
        ...node,
      };
    }),
    edges: diagram.edges.map((edge) => ({
      label: "",
      dashed: false,
      ...edge,
    })),
  };
}
