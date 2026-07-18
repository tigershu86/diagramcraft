const DIAGRAM_KINDS = new Set(["architecture", "flowchart"]);
const SHAPES = new Set(["rect", "terminal", "decision", "data", "subprocess", "database", "dashed-rect"]);
const ANCHORS = new Set(["top", "right", "bottom", "left"]);

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

function positiveNumber(value) {
  return Number.isFinite(value) && value > 0;
}

function optionalString(issues, value, code, path, message) {
  if (value !== undefined && typeof value !== "string") {
    issues.push(issue(code, path, message));
  }
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
  if (typeof diagram.title !== "string") {
    issues.push(issue("invalid-title", "title", "title must be a string"));
  }
  optionalString(issues, diagram.subtitle, "invalid-subtitle", "subtitle", "subtitle must be a string");
  if (diagram.nodeDefaults !== undefined) {
    if (!diagram.nodeDefaults || typeof diagram.nodeDefaults !== "object" || Array.isArray(diagram.nodeDefaults)) {
      issues.push(issue("invalid-node-defaults", "nodeDefaults", "nodeDefaults must be an object"));
    } else {
      for (const dimension of ["width", "height"]) {
        if (diagram.nodeDefaults[dimension] !== undefined && !positiveNumber(diagram.nodeDefaults[dimension])) {
          issues.push(issue(`invalid-node-default-${dimension}`, `nodeDefaults.${dimension}`, `nodeDefaults ${dimension} must be a positive number`));
        }
      }
      if (diagram.nodeDefaults.shape !== undefined && !SHAPES.has(diagram.nodeDefaults.shape)) {
        issues.push(issue("invalid-node-default-shape", "nodeDefaults.shape", "nodeDefaults shape must be supported"));
      }
      optionalString(issues, diagram.nodeDefaults.sublabel, "invalid-node-default-sublabel", "nodeDefaults.sublabel", "nodeDefaults sublabel must be a string");
    }
  }

  const tiers = Array.isArray(diagram.tiers) ? diagram.tiers : [];
  if (diagram.tiers !== undefined && !Array.isArray(diagram.tiers)) {
    issues.push(issue("invalid-tiers", "tiers", "tiers must be an array"));
  }
  tiers.forEach((tier, index) => {
    const tierPath = `tiers[${index}]`;
    if (!tier || typeof tier !== "object" || Array.isArray(tier)) {
      issues.push(issue("invalid-tier", tierPath, "tier must be an object"));
      return;
    }
    optionalString(issues, tier.id, "invalid-tier-id", `${tierPath}.id`, "tier id must be a string");
    if (typeof tier.label !== "string") issues.push(issue("invalid-tier-label", `${tierPath}.label`, "tier label must be a string"));
    if (tier.y === undefined) issues.push(issue("missing-tier-y", `${tierPath}.y`, "tier y is required"));
    if (tier.height === undefined) issues.push(issue("missing-tier-height", `${tierPath}.height`, "tier height is required"));
    for (const field of ["x", "y"]) {
      if (tier[field] !== undefined && !Number.isFinite(tier[field])) {
        issues.push(issue(`invalid-tier-${field}`, `${tierPath}.${field}`, `tier ${field} must be a finite number`));
      }
    }
    for (const field of ["width", "height"]) {
      if (tier[field] !== undefined && !positiveNumber(tier[field])) {
        issues.push(issue(`invalid-tier-${field}`, `${tierPath}.${field}`, `tier ${field} must be a positive number`));
      }
    }
    optionalString(issues, tier.color, "invalid-tier-color", `${tierPath}.color`, "tier color must be a string");
  });

  const legend = Array.isArray(diagram.legend) ? diagram.legend : [];
  if (diagram.legend !== undefined && !Array.isArray(diagram.legend)) {
    issues.push(issue("invalid-legend", "legend", "legend must be an array"));
  }
  legend.forEach((item, index) => {
    const legendPath = `legend[${index}]`;
    if (typeof item === "string") {
      if (!NODE_PRESETS[item] && !["client", "cdn", "lb", "security", "gateway", "service", "cache", "queue", "search", "external"].includes(item)) {
        issues.push(issue("invalid-legend-type", legendPath, "legend type must be supported"));
      }
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      if (typeof item.type !== "string" || (!NODE_PRESETS[item.type] && !["client", "cdn", "lb", "security", "gateway", "service", "cache", "queue", "search"].includes(item.type))) {
        issues.push(issue("invalid-legend-type", `${legendPath}.type`, "legend type must be supported"));
      }
      if (typeof item.label !== "string") issues.push(issue("invalid-legend-label", `${legendPath}.label`, "legend label must be a string"));
    } else {
      issues.push(issue("invalid-legend-item", legendPath, "legend item must be a supported string or object"));
    }
  });

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
    if (typeof node.label !== "string") issues.push(issue("invalid-node-label", `${nodePath}.label`, "node label must be a string"));
    if (typeof node.type !== "string") issues.push(issue("invalid-node-type", `${nodePath}.type`, "node type must be a string"));
    optionalString(issues, node.sublabel, "invalid-node-sublabel", `${nodePath}.sublabel`, "node sublabel must be a string");
    if (node.shape !== undefined && !SHAPES.has(node.shape)) issues.push(issue("invalid-node-shape", `${nodePath}.shape`, "node shape must be supported"));
    for (const dimension of ["width", "height"]) {
      if (node[dimension] !== undefined && !positiveNumber(node[dimension])) {
        issues.push(issue(`invalid-node-${dimension}`, `${nodePath}.${dimension}`, `node ${dimension} must be a positive number`));
      }
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
    if (typeof edge.from !== "string") issues.push(issue("invalid-edge-from", `${edgePath}.from`, "edge source must be a string"));
    if (typeof edge.to !== "string") issues.push(issue("invalid-edge-to", `${edgePath}.to`, "edge target must be a string"));
    optionalString(issues, edge.label, "invalid-edge-label", `${edgePath}.label`, "edge label must be a string");
    if (edge.dashed !== undefined && typeof edge.dashed !== "boolean") {
      issues.push(issue("invalid-edge-dashed", `${edgePath}.dashed`, "edge dashed must be a boolean"));
    }
    for (const anchor of ["fromAnchor", "toAnchor"]) {
      if (edge[anchor] !== undefined && !ANCHORS.has(edge[anchor])) {
        issues.push(issue(`invalid-edge-${anchor.replace("Anchor", "-anchor").replace("from-", "from-").replace("to-", "to-")}`, `${edgePath}.${anchor}`, `${anchor} must be top, right, bottom, or left`));
      }
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
