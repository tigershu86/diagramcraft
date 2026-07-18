const ANCHORS = new Set(["top", "right", "bottom", "left"]);
const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });
const WIDE_GRAPHEME = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\u3000-\u303F\uFF01-\uFF60\uFFE0-\uFFE6]/u;
const EMOJI_GRAPHEME = /\p{Extended_Pictographic}/u;
const ASCII_GRAPHEME = /^[\x00-\x7F]\p{Mark}*$/u;
export const EDGE_SCENE_PADDING = 12;

export function anchorPoint(node, side) {
  if (!ANCHORS.has(side)) throw new TypeError(`Unknown anchor: ${side}`);
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  if (side === "top") return [centerX, node.y];
  if (side === "right") return [node.x + node.width, centerY];
  if (side === "bottom") return [centerX, node.y + node.height];
  return [node.x, centerY];
}

function offsetPoint([x, y], side, distance) {
  if (side === "top") return [x, y - distance];
  if (side === "right") return [x + distance, y];
  if (side === "bottom") return [x, y + distance];
  return [x - distance, y];
}

function inferAnchors(fromNode, toNode) {
  const fromCenter = [fromNode.x + fromNode.width / 2, fromNode.y + fromNode.height / 2];
  const toCenter = [toNode.x + toNode.width / 2, toNode.y + toNode.height / 2];
  const dx = toCenter[0] - fromCenter[0];
  const dy = toCenter[1] - fromCenter[1];
  if (Math.abs(dy) >= Math.abs(dx) * 0.65) {
    return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"];
  }
  return dx >= 0 ? ["right", "left"] : ["left", "right"];
}

export function cubicPoint(points, t) {
  const { start, control1, control2, end } = points;
  const inverse = 1 - t;
  const x = inverse ** 3 * start[0]
    + 3 * inverse ** 2 * t * control1[0]
    + 3 * inverse * t ** 2 * control2[0]
    + t ** 3 * end[0];
  const y = inverse ** 3 * start[1]
    + 3 * inverse ** 2 * t * control1[1]
    + 3 * inverse * t ** 2 * control2[1]
    + t ** 3 * end[1];
  return [x, y];
}

export function edgeLabelMetrics(label) {
  const textLength = label
    ? [...GRAPHEME_SEGMENTER.segment(label)].reduce((total, { segment }) => {
      if (EMOJI_GRAPHEME.test(segment) || WIDE_GRAPHEME.test(segment)) return total + 10;
      if (ASCII_GRAPHEME.test(segment)) return total + 6.2;
      return total + 7.2;
    }, 0)
    : 0;
  return {
    width: label ? Math.max(36, textLength + 14) : 0,
    height: 18,
    textLength,
  };
}

export function edgeLabelWidth(label) {
  return edgeLabelMetrics(label).width;
}

function clamp(value, lower, upper) {
  return Math.min(upper, Math.max(lower, value));
}

function boundedCenter(value, size, extent, padding) {
  if (!Number.isFinite(value)
    || !Number.isFinite(size)
    || !Number.isFinite(extent)
    || extent < 0) return value;
  const lower = padding + size / 2;
  const upper = extent - padding - size / 2;
  return lower <= upper ? clamp(value, lower, upper) : extent / 2;
}

function boundedCoordinate(value, extent) {
  return Number.isFinite(value) && Number.isFinite(extent) && extent >= 0
    ? clamp(value, 0, extent)
    : value;
}

export function edgeLabelPosition(
  route,
  edge,
  fromNode,
  toNode,
  { padding = EDGE_SCENE_PADDING, width, height } = {},
) {
  const metrics = edgeLabelMetrics(edge.label);
  let [x, y] = route.labelPoint;
  const shortHorizontal = edge.route !== "feedback"
    && ["left", "right"].includes(route.fromAnchor)
    && ["left", "right"].includes(route.toAnchor)
    && Math.abs(route.points.end[0] - route.points.start[0]) < 80
    && Math.abs(route.points.end[1] - route.points.start[1]) < 2;
  if (shortHorizontal) y = Math.min(fromNode.y, toNode.y) - 10;
  if (edge.route === "feedback") y = Math.max(y, padding + metrics.height / 2);
  const scenePadding = edge.route === "feedback" ? padding : 0;
  x = boundedCenter(x, metrics.width, width, scenePadding);
  y = boundedCenter(y, metrics.height, height, scenePadding);
  return {
    ...metrics,
    x,
    y,
    left: x - metrics.width / 2,
    right: x + metrics.width / 2,
    top: y - metrics.height / 2,
    bottom: y + metrics.height / 2,
  };
}

export function routeEdge(fromNode, toNode, edge = {}, { width, height } = {}) {
  if (edge.route === "feedback") {
    const fromAnchor = "right";
    const toAnchor = "right";
    const start = anchorPoint(fromNode, fromAnchor);
    const end = anchorPoint(toNode, toAnchor);
    const gutterX = Math.max(
      Number.isFinite(edge.gutterX) ? edge.gutterX : Number.NEGATIVE_INFINITY,
      start[0] + 28,
      end[0] + 28,
    );
    const selfLoop = fromNode === toNode || fromNode.id === toNode.id;
    const points = {
      start,
      control1: [gutterX, start[1]],
      control2: [gutterX, selfLoop ? start[1] + 48 : end[1]],
      end,
    };
    return {
      d: `M ${start[0]} ${start[1]} C ${points.control1[0]} ${points.control1[1]} ${points.control2[0]} ${points.control2[1]} ${end[0]} ${end[1]}`,
      points,
      fromAnchor,
      toAnchor,
      labelPoint: cubicPoint(points, 0.5),
    };
  }

  const inferred = inferAnchors(fromNode, toNode);
  const fromAnchor = edge.fromAnchor || inferred[0];
  const toAnchor = edge.toAnchor || inferred[1];
  const start = anchorPoint(fromNode, fromAnchor);
  const end = anchorPoint(toNode, toAnchor);
  const explicitAnchors = Boolean(edge.fromAnchor && edge.toAnchor);
  const primaryDistance = ["top", "bottom"].includes(fromAnchor)
    ? Math.abs(end[1] - start[1])
    : Math.abs(end[0] - start[0]);
  const distance = explicitAnchors
    ? Math.max(Math.hypot(end[0] - start[0], end[1] - start[1]) * 0.46, 28)
    : primaryDistance < 56
      ? primaryDistance / 2
      : Math.max(primaryDistance * 0.42, 28);
  const control1 = offsetPoint(start, fromAnchor, distance);
  const control2 = offsetPoint(end, toAnchor, distance);
  // A cubic Bézier stays inside the convex hull of its endpoints and controls.
  const boundedControl = ([x, y]) => [
    boundedCoordinate(x, width),
    boundedCoordinate(y, height),
  ];
  const points = {
    start,
    control1: boundedControl(control1),
    control2: boundedControl(control2),
    end,
  };
  const d = `M ${start[0]} ${start[1]} C ${points.control1[0]} ${points.control1[1]} ${points.control2[0]} ${points.control2[1]} ${end[0]} ${end[1]}`;

  return {
    d,
    points,
    fromAnchor,
    toAnchor,
    labelPoint: cubicPoint(points, 0.5),
  };
}

export function nodeBoundsOverlap(a, b, gap = 0) {
  return a.x < b.x + b.width + gap
    && a.x + a.width + gap > b.x
    && a.y < b.y + b.height + gap
    && a.y + a.height + gap > b.y;
}

export function validateLayout(diagram, options = {}) {
  const { padding = 12, gap = 20 } = options;
  const issues = [];
  for (const node of diagram.nodes) {
    if (node.x < padding
      || node.y < padding
      || node.x + node.width > diagram.width - padding
      || node.y + node.height > diagram.height - padding) {
      issues.push({
        code: "layout-node-out-of-bounds",
        nodeIds: [node.id],
        message: `Node ${node.id} exceeds the canvas bounds`,
      });
    }
  }
  for (let first = 0; first < diagram.nodes.length; first += 1) {
    for (let second = first + 1; second < diagram.nodes.length; second += 1) {
      if (nodeBoundsOverlap(diagram.nodes[first], diagram.nodes[second], gap)) {
        issues.push({
          code: "layout-node-overlap",
          nodeIds: [diagram.nodes[first].id, diagram.nodes[second].id],
          message: `Nodes ${diagram.nodes[first].id} and ${diagram.nodes[second].id} overlap`,
        });
      }
    }
  }
  return issues;
}
