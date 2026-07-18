import {
  ANCHORS,
  DEFAULT_NODE,
  DIAGRAM_FIELDS,
  DIAGRAM_KINDS,
  EDGE_FIELDS,
  hasOwnPosition,
  hasPartialPosition,
  LEGEND_OBJECT_FIELDS,
  NODE_DEFAULT_FIELDS,
  NODE_FIELDS,
  NODE_PRESETS,
  NODE_SHAPES,
  NODE_TYPES,
  TIER_FIELDS,
} from "./contract.js";
import { isSupportedPaint, NODE_STYLE_PAINT_FIELDS, snapshotPlainRecord } from "./paint.js";

const kinds = new Set(DIAGRAM_KINDS);
const anchors = new Set(ANCHORS);
const shapes = new Set(NODE_SHAPES);
const nodeTypes = new Set(NODE_TYPES);
const nodeDefaultFields = new Set(NODE_DEFAULT_FIELDS);
const diagramFields = new Set(DIAGRAM_FIELDS);
const tierFields = new Set(TIER_FIELDS);
const nodeFields = new Set(NODE_FIELDS);
const edgeFields = new Set(EDGE_FIELDS);
const legendObjectFields = new Set(LEGEND_OBJECT_FIELDS);
const nodeStylePaintFields = new Set(NODE_STYLE_PAINT_FIELDS);

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

function validateOptionalCanvasDimension(issues, diagram, dimension) {
  if (diagram[dimension] !== undefined && !positiveNumber(diagram[dimension])) {
    issues.push(issue(`invalid-${dimension}`, dimension, `${dimension} must be a positive number`));
  }
}

function validateKnownFields(issues, value, allowedFields, code, path, description) {
  Object.getOwnPropertyNames(value).forEach((field) => {
    if (!allowedFields.has(field)) {
      const fieldPath = path ? `${path}.${field}` : field;
      issues.push(issue(code, fieldPath, `${description} ${field} is not supported`));
    }
  });
}

function snapshotDiagramStyles(diagram) {
  if (!diagram || typeof diagram !== "object" || Array.isArray(diagram) || !Array.isArray(diagram.nodes)) {
    return diagram;
  }
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      if (!node || typeof node !== "object" || Array.isArray(node)) return node;
      const snapshotNode = { ...node };
      if (snapshotNode.style !== undefined) {
        const styleSnapshot = snapshotPlainRecord(snapshotNode.style);
        snapshotNode.style = styleSnapshot.ok ? styleSnapshot.value : null;
      }
      return snapshotNode;
    }),
  };
}

function validateDiagramSnapshot(diagram, options = {}) {
  const issues = [];
  const layout = options.layout || "missing";

  if (!diagram || typeof diagram !== "object" || Array.isArray(diagram)) {
    return [issue("invalid-diagram", "$", "Diagram must be an object")];
  }

  validateKnownFields(issues, diagram, diagramFields, "unknown-diagram-field", "", "diagram field");
  if (!kinds.has(diagram.kind)) {
    issues.push(issue("invalid-kind", "kind", "kind must be architecture or flowchart"));
  }
  validateOptionalCanvasDimension(issues, diagram, "width");
  validateOptionalCanvasDimension(issues, diagram, "height");
  if (typeof diagram.title !== "string" || diagram.title.length === 0) {
    issues.push(issue("invalid-title", "title", "title must be a non-empty string"));
  }
  optionalString(issues, diagram.subtitle, "invalid-subtitle", "subtitle", "subtitle must be a string");
  if (diagram.nodeDefaults !== undefined) {
    if (!diagram.nodeDefaults || typeof diagram.nodeDefaults !== "object" || Array.isArray(diagram.nodeDefaults)) {
      issues.push(issue("invalid-node-defaults", "nodeDefaults", "nodeDefaults must be an object"));
    } else {
      Object.getOwnPropertyNames(diagram.nodeDefaults).forEach((field) => {
        if (!nodeDefaultFields.has(field)) {
          issues.push(issue("invalid-node-default-field", `nodeDefaults.${field}`, `nodeDefaults ${field} is not supported`));
        }
      });
      for (const dimension of ["width", "height"]) {
        if (diagram.nodeDefaults[dimension] !== undefined && !positiveNumber(diagram.nodeDefaults[dimension])) {
          issues.push(issue(`invalid-node-default-${dimension}`, `nodeDefaults.${dimension}`, `nodeDefaults ${dimension} must be a positive number`));
        }
      }
      if (diagram.nodeDefaults.shape !== undefined && !shapes.has(diagram.nodeDefaults.shape)) {
        issues.push(issue("invalid-node-default-shape", "nodeDefaults.shape", "nodeDefaults shape must be supported"));
      }
      optionalString(issues, diagram.nodeDefaults.sublabel, "invalid-node-default-sublabel", "nodeDefaults.sublabel", "nodeDefaults sublabel must be a string");
    }
  }

  const tiers = Array.isArray(diagram.tiers) ? diagram.tiers : [];
  if (diagram.tiers !== undefined && !Array.isArray(diagram.tiers)) {
    issues.push(issue("invalid-tiers", "tiers", "tiers must be an array"));
  }
  const tierIds = new Set();
  tiers.forEach((tier, index) => {
    const tierPath = `tiers[${index}]`;
    if (!tier || typeof tier !== "object" || Array.isArray(tier)) {
      issues.push(issue("invalid-tier", tierPath, "tier must be an object"));
      return;
    }
    validateKnownFields(issues, tier, tierFields, "unknown-tier-field", tierPath, "tier field");
    if (typeof tier.id !== "string" || tier.id.length === 0) {
      issues.push(issue("invalid-tier-id", `${tierPath}.id`, "tier id must be a non-empty string"));
    } else if (tierIds.has(tier.id)) {
      issues.push(issue("duplicate-tier-id", `${tierPath}.id`, `duplicate tier id: ${tier.id}`));
    } else {
      tierIds.add(tier.id);
    }
    if (typeof tier.label !== "string") issues.push(issue("invalid-tier-label", `${tierPath}.label`, "tier label must be a string"));
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
    if (tier.color !== undefined && !isSupportedPaint(tier.color)) {
      issues.push(issue(
        "invalid-tier-color",
        `${tierPath}.color`,
        "tier color must be a supported standalone paint",
      ));
    }
  });

  const legend = Array.isArray(diagram.legend) ? diagram.legend : [];
  if (diagram.legend !== undefined && !Array.isArray(diagram.legend)) {
    issues.push(issue("invalid-legend", "legend", "legend must be an array"));
  }
  legend.forEach((item, index) => {
    const legendPath = `legend[${index}]`;
    if (typeof item === "string") {
      if (!nodeTypes.has(item)) issues.push(issue("invalid-legend-type", legendPath, "legend type must be supported"));
    } else if (item && typeof item === "object" && !Array.isArray(item)) {
      validateKnownFields(issues, item, legendObjectFields, "unknown-legend-object-field", legendPath, "legend field");
      if (typeof item.type !== "string" || !nodeTypes.has(item.type)) {
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
  const requireTier = diagram.kind === "architecture" && tiers.length > 0
    && (layout === "force" || nodes.some((node) => !hasOwnPosition(node)));
  nodes.forEach((node, index) => {
    const nodePath = `nodes[${index}]`;
    if (!node || typeof node !== "object" || Array.isArray(node)) {
      issues.push(issue("invalid-node", nodePath, "node must be an object"));
      return;
    }
    validateKnownFields(issues, node, nodeFields, "unknown-node-field", nodePath, "node field");
    if (typeof node.id !== "string" || node.id.length === 0) {
      issues.push(issue("invalid-node-id", `${nodePath}.id`, "node id must be a non-empty string"));
    } else if (ids.has(node.id)) {
      issues.push(issue("duplicate-node-id", `${nodePath}.id`, `duplicate node id: ${node.id}`));
    } else {
      ids.add(node.id);
    }
    if (hasPartialPosition(node)) {
      issues.push(issue("partial-node-position", nodePath, "node x and y must be provided together"));
    } else if (hasOwnPosition(node) && (!Number.isFinite(node.x) || !Number.isFinite(node.y))) {
      issues.push(issue("invalid-node-position", nodePath, "node x and y must be finite numbers"));
    }
    if (typeof node.label !== "string" || node.label.length === 0) issues.push(issue("invalid-node-label", `${nodePath}.label`, "node label must be a non-empty string"));
    if (typeof node.type !== "string" || !nodeTypes.has(node.type)) issues.push(issue("invalid-node-type", `${nodePath}.type`, "node type must be supported"));
    optionalString(issues, node.sublabel, "invalid-node-sublabel", `${nodePath}.sublabel`, "node sublabel must be a string");
    if (node.fontSize !== undefined && !positiveNumber(node.fontSize)) {
      issues.push(issue("invalid-node-font-size", `${nodePath}.fontSize`, "node fontSize must be a positive number"));
    }
    if (node.style !== undefined) {
      if (!node.style || typeof node.style !== "object" || Array.isArray(node.style)) {
        issues.push(issue("invalid-node-style", `${nodePath}.style`, "node style must be a plain object"));
      } else {
        validateKnownFields(
          issues,
          node.style,
          nodeStylePaintFields,
          "unknown-node-style-field",
          `${nodePath}.style`,
          "node style field",
        );
        NODE_STYLE_PAINT_FIELDS.forEach((field) => {
          if (Object.hasOwn(node.style, field) && !isSupportedPaint(node.style[field])) {
            issues.push(issue(
              "invalid-node-style-paint",
              `${nodePath}.style.${field}`,
              `node style ${field} must be a supported standalone paint`,
            ));
          }
        });
      }
    }
    if (node.shape !== undefined && !shapes.has(node.shape)) issues.push(issue("invalid-node-shape", `${nodePath}.shape`, "node shape must be supported"));
    for (const dimension of ["width", "height"]) {
      if (node[dimension] !== undefined && !positiveNumber(node[dimension])) {
        issues.push(issue(`invalid-node-${dimension}`, `${nodePath}.${dimension}`, `node ${dimension} must be a positive number`));
      }
    }
    if (node.tier !== undefined && (typeof node.tier !== "string" || !tierIds.has(node.tier))) {
      issues.push(issue("unknown-node-tier", `${nodePath}.tier`, `unknown tier: ${node.tier}`));
    }
    if (requireTier && node.tier === undefined) {
      issues.push(issue("missing-node-tier", `${nodePath}.tier`, "node tier is required for this architecture layout"));
    }
  });

  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
  if (!Array.isArray(diagram.edges)) {
    issues.push(issue("invalid-edges", "edges", "edges must be an array"));
  }
  edges.forEach((edge, index) => {
    const edgePath = `edges[${index}]`;
    if (!edge || typeof edge !== "object" || Array.isArray(edge)) {
      issues.push(issue("invalid-edge", edgePath, "edge must be an object"));
      return;
    }
    validateKnownFields(issues, edge, edgeFields, "unknown-edge-field", edgePath, "edge field");
    if (!ids.has(edge.from)) issues.push(issue("missing-edge-source", `${edgePath}.from`, `missing edge source: ${edge.from}`));
    if (!ids.has(edge.to)) issues.push(issue("missing-edge-target", `${edgePath}.to`, `missing edge target: ${edge.to}`));
    if (typeof edge.from !== "string") issues.push(issue("invalid-edge-from", `${edgePath}.from`, "edge source must be a string"));
    if (typeof edge.to !== "string") issues.push(issue("invalid-edge-to", `${edgePath}.to`, "edge target must be a string"));
    optionalString(issues, edge.id, "invalid-edge-id", `${edgePath}.id`, "edge id must be a string");
    optionalString(issues, edge.label, "invalid-edge-label", `${edgePath}.label`, "edge label must be a string");
    if (edge.dashed !== undefined && typeof edge.dashed !== "boolean") {
      issues.push(issue("invalid-edge-dashed", `${edgePath}.dashed`, "edge dashed must be a boolean"));
    }
    for (const anchor of ["fromAnchor", "toAnchor"]) {
      if (edge[anchor] !== undefined && !anchors.has(edge[anchor])) {
        issues.push(issue(`invalid-edge-${anchor.replace("Anchor", "-anchor")}`, `${edgePath}.${anchor}`, `${anchor} must be top, right, bottom, or left`));
      }
    }
  });

  return issues;
}

export function validateDiagram(diagram, options = {}) {
  return validateDiagramSnapshot(snapshotDiagramStyles(diagram), options);
}

function validatePreparedDiagramSnapshot(diagram, options = {}) {
  const issues = validateDiagramSnapshot(diagram, options);
  if (issues.length > 0) return issues;
  const normalized = normalizeValidatedDiagram(diagram);

  if (!positiveNumber(normalized.width)) issues.push(issue("unprepared-width", "width", "width must be a positive number before rendering"));
  if (!positiveNumber(normalized.height)) issues.push(issue("unprepared-height", "height", "height must be a positive number before rendering"));
  normalized.tiers.forEach((tier, index) => {
      if (!tier || typeof tier !== "object" || Array.isArray(tier)) return;
      if (!Number.isFinite(tier.y)) issues.push(issue("unprepared-tier-y", `tiers[${index}].y`, "tier y must be finite before rendering"));
      if (!positiveNumber(tier.height)) issues.push(issue("unprepared-tier-height", `tiers[${index}].height`, "tier height must be positive before rendering"));
  });
  normalized.nodes.forEach((node, index) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
      issues.push(issue("unprepared-node-position", `nodes[${index}]`, "node x and y must be finite before rendering"));
    }
    for (const dimension of ["width", "height"]) {
      if (!positiveNumber(node[dimension])) {
        issues.push(issue(`unprepared-node-${dimension}`, `nodes[${index}].${dimension}`, `node ${dimension} must be positive before rendering`));
      }
    }
    if (!shapes.has(node.shape)) {
      issues.push(issue("unprepared-node-shape", `nodes[${index}].shape`, "node shape must be supported before rendering"));
    }
  });
  return issues;
}

export function validatePreparedDiagram(diagram, options = {}) {
  return validatePreparedDiagramSnapshot(snapshotDiagramStyles(diagram), options);
}

function assertWith(validator, diagram, options) {
  const issues = validator(diagram, options);
  throwForIssues(issues);
  return diagram;
}

function throwForIssues(issues) {
  if (issues.length > 0) {
    const details = issues.map(({ code, path, message }) => `${code} at ${path}: ${message}`).join("\n");
    throw new TypeError(`Invalid diagram:\n${details}`);
  }
}

export function assertDiagram(diagram, options = {}) {
  return assertWith(validateDiagram, diagram, options);
}

export function assertPreparedDiagram(diagram, options = {}) {
  const snapshot = snapshotDiagramStyles(diagram);
  const issues = validatePreparedDiagramSnapshot(snapshot, options);
  throwForIssues(issues);
  return normalizeValidatedDiagram(snapshot);
}

function definedEntries(value) {
  return Object.entries(value).filter(([, entry]) => entry !== undefined);
}

function normalizeValidatedDiagram(diagram) {
  const nodeDefaults = Object.fromEntries(
    NODE_DEFAULT_FIELDS
      .filter((field) => diagram.nodeDefaults?.[field] !== undefined)
      .map((field) => [field, diagram.nodeDefaults[field]]),
  );
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
        ...nodeDefaults,
        ...Object.fromEntries(definedEntries(node)),
      };
    }),
    edges: diagram.edges.map((edge) => ({
      label: "",
      dashed: false,
      ...edge,
    })),
  };
}

export function normalizeDiagram(diagram, options = {}) {
  const snapshot = snapshotDiagramStyles(diagram);
  throwForIssues(validateDiagramSnapshot(snapshot, options));
  return normalizeValidatedDiagram(snapshot);
}
