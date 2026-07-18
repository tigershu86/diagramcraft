import { hasOwnPosition } from "../contract.js";
import {
  EDGE_SCENE_PADDING,
  edgeLabelPosition,
  nodeBoundsOverlap,
  routeEdge,
  validateLayout,
} from "../geometry.js";
import { normalizeDiagram } from "../schema.js";
import { ARCHITECTURE_LAYOUT, layoutArchitecture } from "./architecture.js";
import { layoutFlowchart } from "./flowchart.js";

const CANVAS_PADDING = 24;
const FEEDBACK_MARGIN = 60;
const TIER_GEOMETRY_FIELDS = ["x", "y", "width", "height"];
const VALID_MODES = new Set(["missing", "force"]);
const INTERNAL_LAYOUTS = new WeakSet();

function markInternalLayout(diagram) {
  INTERNAL_LAYOUTS.add(diagram);
  return diagram;
}

function rawLayoutInput(input) {
  if (!INTERNAL_LAYOUTS.has(input)) return input;
  return {
    ...input,
    edges: Array.isArray(input.edges)
      ? input.edges.map(({ route: _route, gutterX: _gutterX, ...edge }) => edge)
      : input.edges,
  };
}

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

function blockedOffsetIntervals(node, placed, step) {
  const gap = ARCHITECTURE_LAYOUT.NODE_GAP;
  const minimumOffset = Math.ceil(-node.x / step);
  const intervals = placed.flatMap((reservation) => {
    const verticallyBlocked = node.y < reservation.y + reservation.height + gap
      && node.y + node.height + gap > reservation.y;
    if (!verticallyBlocked) return [];
    const lower = Math.max(
      minimumOffset,
      Math.floor((reservation.x - node.width - gap - node.x) / step) + 1,
    );
    const upper = Math.ceil((reservation.x + reservation.width + gap - node.x) / step) - 1;
    return lower <= upper ? [[lower, upper]] : [];
  }).sort((left, right) => left[0] - right[0] || left[1] - right[1]);

  return intervals.reduce((merged, interval) => {
    const previous = merged.at(-1);
    if (previous && interval[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], interval[1]);
    else merged.push([...interval]);
    return merged;
  }, []);
}

function nearestOpenOffset(intervals, minimumOffset) {
  let right = Math.max(0, minimumOffset);
  for (const [lower, upper] of intervals) {
    if (upper < right) continue;
    if (lower > right) break;
    right = upper + 1;
  }

  let left = minimumOffset <= -1 ? -1 : null;
  if (left !== null) {
    for (let index = intervals.length - 1; index >= 0; index -= 1) {
      const [lower, upper] = intervals[index];
      if (lower > left) continue;
      if (upper < left) break;
      left = lower - 1;
      if (left < minimumOffset) {
        left = null;
        break;
      }
    }
  }
  return left === null || right <= Math.abs(left) ? right : left;
}

function reserveHorizontalPosition(node, placed) {
  const step = ARCHITECTURE_LAYOUT.NODE_GAP;
  const minimumOffset = Math.ceil(-node.x / step);
  const intervals = blockedOffsetIntervals(node, placed, step);
  const offset = nearestOpenOffset(intervals, minimumOffset);
  return { ...node, x: node.x + offset * step };
}

function fitFeedback(edges, nodes, width, height) {
  const maxRight = Math.max(0, ...nodes.map((node) => node.x + node.width));
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  let fittedWidth = width;
  let fittedHeight = height;
  const fittedEdges = edges.map((edge) => {
    if (edge.route !== "feedback") return { ...edge };
    let gutterX = Math.max(
      Number.isFinite(edge.gutterX) ? edge.gutterX : Number.NEGATIVE_INFINITY,
      maxRight + FEEDBACK_MARGIN,
    );
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    let route = routeEdge(fromNode, toNode, { ...edge, gutterX });
    let label = edgeLabelPosition(route, edge, fromNode, toNode);
    if (edge.label && label.left < EDGE_SCENE_PADDING) {
      gutterX += (EDGE_SCENE_PADDING - label.left) / 0.75 + 1e-9;
      route = routeEdge(fromNode, toNode, { ...edge, gutterX });
      label = edgeLabelPosition(route, edge, fromNode, toNode);
    }
    const pathPoints = Object.values(route.points);
    fittedWidth = Math.max(
      fittedWidth,
      gutterX + FEEDBACK_MARGIN,
      ...pathPoints.map(([x]) => x + EDGE_SCENE_PADDING),
      edge.label ? label.right + EDGE_SCENE_PADDING : 0,
    );
    fittedHeight = Math.max(
      fittedHeight,
      ...pathPoints.map(([, y]) => y + EDGE_SCENE_PADDING),
      edge.label ? label.bottom + EDGE_SCENE_PADDING : 0,
    );
    return { ...edge, gutterX };
  });
  return { edges: fittedEdges, width: fittedWidth, height: fittedHeight };
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
    Number.isFinite(tier.x) && Number.isFinite(tier.width)
      ? tier.x + tier.width + CANVAS_PADDING
      : 0
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
  const tiers = fillTierGeometry(normalized.tiers, initialCandidates);
  const size = canvasSize(input, nodeSize, tiers);
  return { tiers, size };
}

function fullyPositionedLayout(normalized, input) {
  const nodeSize = contentSize(normalized.nodes);
  const fitted = fittedManualTiers(normalized, input, nodeSize);
  const classifiedEdges = normalized.kind === "flowchart"
    ? layoutFlowchart(normalized).edges
    : normalized.edges.map((edge) => ({ ...edge }));
  const feedback = fitFeedback(classifiedEdges, normalized.nodes, fitted.size.width, fitted.size.height);
  return {
    ...normalized,
    width: feedback.width,
    height: feedback.height,
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
  const feedback = fitFeedback(ideal.edges, merged, width, height);
  width = feedback.width;
  height = feedback.height;
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
  const rawInput = rawLayoutInput(input);
  const normalized = normalizeDiagram(rawInput, { layout: mode });
  const allPositioned = normalized.nodes.every(hasOwnPosition);
  if (mode === "missing" && allPositioned) {
    return markInternalLayout(fullyPositionedLayout(normalized, rawInput));
  }

  const ideal = automaticLayout(normalized);
  if (mode === "force") {
    const feedback = fitFeedback(ideal.edges, ideal.nodes, ideal.width, ideal.height);
    return markInternalLayout({
      ...ideal,
      width: feedback.width,
      height: feedback.height,
      edges: feedback.edges,
    });
  }
  return markInternalLayout(mixedLayout(normalized, rawInput, ideal));
}

function effectiveTiers(diagram) {
  return diagram.tiers.map((tier) => ({
    ...tier,
    x: tier.x ?? 12,
    width: tier.width ?? diagram.width - 24,
  }));
}

function validatePreparedTiers(diagram) {
  const issues = [];
  const tiers = effectiveTiers(diagram);
  const validRectangles = new Map();
  tiers.forEach((tier) => {
    const validX = Number.isFinite(tier.x);
    const validWidth = Number.isFinite(tier.width) && tier.width > 0;
    const validY = Number.isFinite(tier.y);
    const validHeight = Number.isFinite(tier.height) && tier.height > 0;
    if (!validX) {
      issues.push({
        code: "layout-tier-x",
        nodeIds: [tier.id],
        message: `Tier ${tier.id} x must be finite before rendering`,
      });
    }
    if (!validWidth) {
      issues.push({
        code: "layout-tier-width",
        nodeIds: [tier.id],
        message: `Tier ${tier.id} width must be positive before rendering`,
      });
    }
    if (!validY) {
      issues.push({
        code: "layout-tier-y",
        nodeIds: [tier.id],
        message: `Tier ${tier.id} y must be finite before rendering`,
      });
    }
    if (!validHeight) {
      issues.push({
        code: "layout-tier-height",
        nodeIds: [tier.id],
        message: `Tier ${tier.id} height must be positive before rendering`,
      });
    }
    if (!validX || !validWidth || !validY || !validHeight) return;
    validRectangles.set(tier.id, tier);
    if (tier.x < 0
      || tier.y < 0
      || tier.x + tier.width > diagram.width
      || tier.y + tier.height > diagram.height) {
      issues.push({
        code: "layout-tier-out-of-bounds",
        nodeIds: [tier.id],
        message: `Tier ${tier.id} exceeds the canvas bounds`,
      });
    }
  });

  for (let first = 0; first < tiers.length; first += 1) {
    const firstTier = validRectangles.get(tiers[first].id);
    if (!firstTier) continue;
    for (let second = first + 1; second < tiers.length; second += 1) {
      const secondTier = validRectangles.get(tiers[second].id);
      if (secondTier && nodeBoundsOverlap(firstTier, secondTier)) {
        issues.push({
          code: "layout-tier-overlap",
          nodeIds: [firstTier.id, secondTier.id],
          message: `Tiers ${firstTier.id} and ${secondTier.id} overlap`,
        });
      }
    }
  }

  diagram.nodes.forEach((node) => {
    if (node.tier === undefined) return;
    const tier = validRectangles.get(node.tier);
    if (!tier) return;
    const contained = node.x >= tier.x
      && node.y >= tier.y
      && node.x + node.width <= tier.x + tier.width
      && node.y + node.height <= tier.y + tier.height;
    if (!contained) {
      issues.push({
        code: "layout-node-outside-tier",
        nodeIds: [node.id, tier.id],
        message: `Node ${node.id} is not fully contained by tier ${tier.id}`,
      });
    }
  });
  return issues;
}

function validateFiniteGeometry(diagram) {
  const issues = [];
  for (const dimension of ["width", "height"]) {
    if (!Number.isFinite(diagram[dimension])) {
      issues.push({
        code: `layout-canvas-${dimension}`,
        nodeIds: [],
        message: `Canvas ${dimension} must remain finite after layout`,
      });
    }
  }
  diagram.nodes.forEach((node) => {
    for (const [side, value] of [
      ["right", node.x + node.width],
      ["bottom", node.y + node.height],
    ]) {
      if (!Number.isFinite(value)) {
        issues.push({
          code: `layout-node-${side}`,
          nodeIds: [node.id],
          message: `Node ${node.id} ${side} bound must remain finite after layout`,
        });
      }
    }
  });
  effectiveTiers(diagram).forEach((tier) => {
    for (const [side, value] of [
      ["right", tier.x + tier.width],
      ["bottom", tier.y + tier.height],
    ]) {
      if (!Number.isFinite(value)) {
        issues.push({
          code: `layout-tier-${side}`,
          nodeIds: [tier.id],
          message: `Tier ${tier.id} ${side} bound must remain finite after layout`,
        });
      }
    }
  });
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  diagram.edges.forEach((edge) => {
    if (edge.route !== "feedback") return;
    const nodeIds = [edge.from, edge.to];
    if (!Number.isFinite(edge.gutterX)) {
      issues.push({
        code: "layout-feedback-gutter",
        nodeIds,
        message: `Feedback edge ${edge.from} to ${edge.to} gutter must remain finite after layout`,
      });
    }
    const fromNode = nodeMap.get(edge.from);
    const toNode = nodeMap.get(edge.to);
    const route = routeEdge(fromNode, toNode, edge);
    if (![route.points.control1, route.points.control2].flat().every(Number.isFinite)) {
      issues.push({
        code: "layout-feedback-control",
        nodeIds,
        message: `Feedback edge ${edge.from} to ${edge.to} controls must remain finite after layout`,
      });
    }
    if (!Object.values(route.points).flat().every(Number.isFinite)) {
      issues.push({
        code: "layout-feedback-path-bounds",
        nodeIds,
        message: `Feedback edge ${edge.from} to ${edge.to} path bounds must remain finite after layout`,
      });
    }
    const label = edgeLabelPosition(route, edge, fromNode, toNode);
    if (![label.left, label.right, label.top, label.bottom].every(Number.isFinite)) {
      issues.push({
        code: "layout-feedback-label-bounds",
        nodeIds,
        message: `Feedback edge ${edge.from} to ${edge.to} label bounds must remain finite after layout`,
      });
    }
  });
  return issues;
}

export function prepareDiagram(input, { layout = "missing" } = {}) {
  const result = layoutDiagram(input, { mode: layout });
  const issues = [
    ...validateFiniteGeometry(result),
    ...validateLayout(result, { padding: 0, gap: 0 }),
    ...validatePreparedTiers(result),
  ];
  if (issues.length > 0) {
    const details = issues.map(({ code, nodeIds, message }) => {
      const mappedCode = code.startsWith("layout-") ? code : `layout-${code}`;
      return `${mappedCode} [${nodeIds.join(", ")}]: ${message}`;
    }).join("\n");
    throw new TypeError(`Invalid prepared diagram layout:\n${details}`);
  }
  return result;
}
