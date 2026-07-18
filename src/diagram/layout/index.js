import { hasOwnPosition } from "../contract.js";
import { nodeBoundsOverlap, validateLayout } from "../geometry.js";
import { normalizeDiagram } from "../schema.js";
import { ARCHITECTURE_LAYOUT, layoutArchitecture } from "./architecture.js";
import { layoutFlowchart } from "./flowchart.js";

const CANVAS_PADDING = 24;
const FEEDBACK_MARGIN = 60;
const TIER_GEOMETRY_FIELDS = ["x", "y", "width", "height"];
const VALID_MODES = new Set(["missing", "force"]);

function automaticLayout(diagram) {
  if (diagram.kind === "architecture" && diagram.tiers.length > 0) {
    return layoutArchitecture(diagram);
  }
  return layoutFlowchart(diagram);
}

function contentSize(nodes) {
  return {
    width: Math.max(CANVAS_PADDING, ...nodes.map((node) => node.x + node.width + CANVAS_PADDING)),
    height: Math.max(CANVAS_PADDING, ...nodes.map((node) => node.y + node.height + CANVAS_PADDING)),
  };
}

function collides(candidate, placed) {
  return placed.some((node) => nodeBoundsOverlap(candidate, node, ARCHITECTURE_LAYOUT.NODE_GAP));
}

function reserveHorizontalPosition(node, placed) {
  const step = ARCHITECTURE_LAYOUT.NODE_GAP;
  for (let offsetIndex = 0; ; offsetIndex += 1) {
    const magnitude = Math.ceil(offsetIndex / 2) * step;
    const offset = offsetIndex === 0 ? 0 : offsetIndex % 2 === 1 ? magnitude : -magnitude;
    const candidate = { ...node, x: node.x + offset };
    if (candidate.x >= 0 && !collides(candidate, placed)) return candidate;
  }
}

function fitFeedback(edges, nodes, width) {
  const maxRight = Math.max(0, ...nodes.map((node) => node.x + node.width));
  let fittedWidth = width;
  const fittedEdges = edges.map((edge) => {
    if (edge.route !== "feedback") return { ...edge };
    const gutterX = Math.max(edge.gutterX, maxRight + FEEDBACK_MARGIN);
    fittedWidth = Math.max(fittedWidth, gutterX + FEEDBACK_MARGIN);
    return { ...edge, gutterX };
  });
  return { edges: fittedEdges, width: fittedWidth };
}

function tierRectangles(tiers, nodes, canvasWidth, { preserveSequenceGeometry = false } = {}) {
  const {
    OUTER,
    TIER_LABEL_HEIGHT,
    TIER_BOTTOM_PADDING,
    TIER_GAP,
  } = ARCHITECTURE_LAYOUT;
  let nextY = OUTER;
  return tiers.map((tier) => {
    const members = nodes.filter((node) => node.tier === tier.id);
    const memberTop = members.length > 0 ? Math.min(...members.map((node) => node.y)) : nextY + TIER_LABEL_HEIGHT;
    const memberBottom = members.length > 0 ? Math.max(...members.map((node) => node.y + node.height)) : memberTop;
    const y = Math.min(memberTop - TIER_LABEL_HEIGHT, nextY);
    const height = Math.max(
      TIER_LABEL_HEIGHT + TIER_BOTTOM_PADDING,
      memberBottom - y + TIER_BOTTOM_PADDING,
    );
    const result = { ...tier, x: 12, y, width: canvasWidth - 24, height };
    const sequenceY = preserveSequenceGeometry && tier.y !== undefined ? tier.y : y;
    const sequenceHeight = preserveSequenceGeometry && tier.height !== undefined ? tier.height : height;
    nextY = Math.max(nextY, sequenceY + sequenceHeight + TIER_GAP);
    return result;
  });
}

function fillTierGeometry(tiers, candidates) {
  return tiers.map((tier, index) => ({
    ...tier,
    ...Object.fromEntries(
      TIER_GEOMETRY_FIELDS
        .filter((field) => tier[field] === undefined)
        .map((field) => [field, candidates[index][field]]),
    ),
  }));
}

function canvasSize(input, nodeSize, tiers) {
  const tierRight = Math.max(0, ...tiers.map((tier) => (
    Number.isFinite(tier.x) && Number.isFinite(tier.width) ? tier.x + tier.width : 0
  )));
  const tierBottom = Math.max(0, ...tiers.map((tier) => (
    Number.isFinite(tier.y) && Number.isFinite(tier.height)
      ? tier.y + tier.height + CANVAS_PADDING
      : 0
  )));
  return {
    width: input.width ?? Math.max(nodeSize.width, tierRight),
    height: input.height ?? Math.max(nodeSize.height, tierBottom),
  };
}

function fittedManualTiers(normalized, input, nodeSize) {
  const hasMembership = normalized.nodes.some((node) => node.tier !== undefined);
  if (normalized.kind !== "architecture" || normalized.tiers.length === 0 || !hasMembership) {
    return {
      tiers: normalized.tiers.map((tier) => ({ ...tier })),
      size: canvasSize(input, nodeSize, normalized.tiers),
    };
  }

  const initialWidth = input.width ?? nodeSize.width;
  const initialCandidates = tierRectangles(
    normalized.tiers,
    normalized.nodes,
    initialWidth,
    { preserveSequenceGeometry: true },
  );
  let tiers = fillTierGeometry(normalized.tiers, initialCandidates);
  let size = canvasSize(input, nodeSize, tiers);
  if (input.width === undefined && size.width !== initialWidth) {
    const finalCandidates = tierRectangles(
      normalized.tiers,
      normalized.nodes,
      size.width,
      { preserveSequenceGeometry: true },
    );
    tiers = fillTierGeometry(normalized.tiers, finalCandidates);
    size = canvasSize(input, nodeSize, tiers);
  }
  return { tiers, size };
}

function fullyPositionedLayout(normalized, input) {
  const nodeSize = contentSize(normalized.nodes);
  const fitted = fittedManualTiers(normalized, input, nodeSize);
  const classifiedEdges = normalized.kind === "flowchart"
    ? layoutFlowchart(normalized).edges
    : normalized.edges.map((edge) => ({ ...edge }));
  const feedback = fitFeedback(classifiedEdges, normalized.nodes, fitted.size.width);
  return {
    ...normalized,
    width: feedback.width,
    height: fitted.size.height,
    tiers: fitted.tiers,
    nodes: normalized.nodes.map((node) => ({ ...node })),
    edges: feedback.edges,
  };
}

function mixedLayout(normalized, input, ideal) {
  const sourcePositions = new Map(
    input.nodes.filter(hasOwnPosition).map((node) => [node.id, { x: node.x, y: node.y }]),
  );
  const fixedIds = new Set(sourcePositions.keys());
  const merged = normalized.nodes.map((node) => {
    const fixed = sourcePositions.get(node.id);
    return fixed ? { ...node, ...fixed } : { ...ideal.nodes.find(({ id }) => id === node.id) };
  });
  const placed = merged.filter((node) => fixedIds.has(node.id));
  merged.forEach((node, index) => {
    if (fixedIds.has(node.id)) return;
    const positioned = reserveHorizontalPosition(node, placed);
    merged[index] = positioned;
    placed.push(positioned);
  });

  const size = contentSize(merged);
  let width = Math.max(input.width ?? 0, ideal.width, size.width);
  let height = Math.max(input.height ?? 0, ideal.height, size.height);
  const feedback = fitFeedback(ideal.edges, merged, width);
  width = feedback.width;
  const tiers = normalized.kind === "architecture" && normalized.tiers.length > 0
    ? tierRectangles(normalized.tiers, merged, width)
    : ideal.tiers.map((tier) => ({ ...tier }));
  if (tiers.length > 0) {
    height = Math.max(height, ...tiers.map((tier) => tier.y + tier.height + CANVAS_PADDING));
  }
  return { ...normalized, width, height, tiers, nodes: merged, edges: feedback.edges };
}

export function layoutDiagram(input, { mode = "missing" } = {}) {
  if (!VALID_MODES.has(mode)) {
    throw new TypeError(`Invalid layout mode: ${mode}. Expected missing or force.`);
  }
  const normalized = normalizeDiagram(input, { layout: mode });
  const allPositioned = normalized.nodes.every(hasOwnPosition);
  if (mode === "missing" && allPositioned) return fullyPositionedLayout(normalized, input);

  const ideal = automaticLayout(normalized);
  if (mode === "force") return ideal;
  return mixedLayout(normalized, input, ideal);
}

export function prepareDiagram(input, { layout = "missing" } = {}) {
  const result = layoutDiagram(input, { mode: layout });
  const issues = validateLayout(result, { padding: 0, gap: 0 });
  if (issues.length > 0) {
    const details = issues.map(({ code, nodeIds, message }) => {
      const mappedCode = code.startsWith("layout-") ? code : `layout-${code}`;
      return `${mappedCode} [${nodeIds.join(", ")}]: ${message}`;
    }).join("\n");
    throw new TypeError(`Invalid prepared diagram layout:\n${details}`);
  }
  return result;
}
