const ANCHORS = new Set(["top", "right", "bottom", "left"]);

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

export function edgeLabelWidth(label) {
  return label ? Math.max(36, label.length * 6.2 + 14) : 0;
}

export function routeEdge(fromNode, toNode, edge = {}) {
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
    const points = {
      start,
      control1: [gutterX, start[1]],
      control2: [gutterX, end[1]],
      end,
    };
    return {
      d: `M ${start[0]} ${start[1]} C ${gutterX} ${start[1]} ${gutterX} ${end[1]} ${end[0]} ${end[1]}`,
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
  const points = { start, control1, control2, end };
  const d = `M ${start[0]} ${start[1]} C ${control1[0]} ${control1[1]} ${control2[0]} ${control2[1]} ${end[0]} ${end[1]}`;

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
