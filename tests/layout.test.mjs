import test from "node:test";
import assert from "node:assert/strict";

import { ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE } from "../examples/diagrams.js";
import {
  edgeLabelPosition,
  edgeLabelWidth,
  nodeBoundsOverlap,
  routeEdge,
} from "../src/diagram/geometry.js";
import { layoutArchitecture } from "../src/diagram/layout/architecture.js";
import { layoutDiagram, prepareDiagram } from "../src/diagram/layout/index.js";
import { normalizeDiagram, validateDiagram } from "../src/diagram/schema.js";

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

function assertFiniteLayout(diagram) {
  assert.ok(Number.isFinite(diagram.width) && diagram.width > 0);
  assert.ok(Number.isFinite(diagram.height) && diagram.height > 0);
  assert.ok(diagram.nodes.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
}

function assertNoOverlap(nodes, gap = 0) {
  for (let first = 0; first < nodes.length; first += 1) {
    for (let second = first + 1; second < nodes.length; second += 1) {
      assert.equal(
        nodeBoundsOverlap(nodes[first], nodes[second], gap),
        false,
        `${nodes[first].id} overlaps ${nodes[second].id}`,
      );
    }
  }
}

function assertFeedbackLabelPillFits(diagram) {
  const edge = diagram.edges.find(({ route }) => route === "feedback");
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const route = routeEdge(nodeMap.get(edge.from), nodeMap.get(edge.to), edge);
  const width = edgeLabelWidth(edge.label);

  assert.ok(route.labelPoint[0] - width / 2 >= 0);
  assert.ok(route.labelPoint[0] + width / 2 <= diagram.width);
}

function longFeedbackFlow() {
  return {
    kind: "flowchart",
    title: "Long forced feedback label",
    nodes: [
      { id: "a", label: "A", type: "process" },
      { id: "b", label: "B", type: "process" },
    ],
    edges: [
      { from: "a", to: "b" },
      {
        from: "b",
        to: "a",
        label: "Return to the beginning after the reviewer requests another complete revision cycle and include every required follow-up note before requesting one more review",
      },
    ],
  };
}

function overflowingExplicitEdgeFlow() {
  return {
    kind: "flowchart",
    title: "Overflowing explicit edge",
    width: Number.MAX_VALUE,
    height: Number.MAX_VALUE,
    nodes: [
      { id: "near", label: "Near", type: "process", x: 20, y: 20, width: 20, height: 20 },
      {
        id: "far",
        label: "Far",
        type: "process",
        x: Number.MAX_VALUE,
        y: Number.MAX_VALUE,
        width: 20,
        height: 20,
      },
    ],
    edges: [{ from: "near", to: "far", label: "far away", fromAnchor: "right", toAnchor: "left" }],
  };
}

function assertFeedbackScenePadding(diagram, padding = 12) {
  const edge = diagram.edges.find(({ route }) => route === "feedback");
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const route = routeEdge(nodeMap.get(edge.from), nodeMap.get(edge.to), edge);
  const labelWidth = edge.label ? Math.max(36, edge.label.length * 6.2 + 14) : 0;
  const labelHeight = 18;

  assert.ok(route.labelPoint[0] - labelWidth / 2 >= padding);
  assert.ok(route.labelPoint[0] + labelWidth / 2 <= diagram.width - padding);
  assert.ok(route.labelPoint[1] - labelHeight / 2 >= padding);
  assert.ok(route.labelPoint[1] + labelHeight / 2 <= diagram.height - padding);
  for (const point of Object.values(route.points)) {
    assert.ok(point[0] >= 0 && point[0] <= diagram.width - padding);
    assert.ok(point[1] >= 0 && point[1] <= diagram.height - padding);
  }
}

function assertOrdinaryEdgeFits(diagram, edge = diagram.edges.find(({ route }) => route !== "feedback")) {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const fromNode = nodeMap.get(edge.from);
  const toNode = nodeMap.get(edge.to);
  const bounds = { width: diagram.width, height: diagram.height };
  const route = routeEdge(fromNode, toNode, edge, bounds);
  const label = edgeLabelPosition(route, edge, fromNode, toNode, bounds);

  for (const [name, [x, y]] of Object.entries(route.points)) {
    assert.ok(x >= 0 && x <= diagram.width, `${name}.x ${x} exceeds 0..${diagram.width}`);
    assert.ok(y >= 0 && y <= diagram.height, `${name}.y ${y} exceeds 0..${diagram.height}`);
  }
  if (edge.label) {
    assert.ok(label.left >= 0, `label.left ${label.left} is negative`);
    assert.ok(label.right <= diagram.width, `label.right ${label.right} exceeds ${diagram.width}`);
    assert.ok(label.top >= 0, `label.top ${label.top} is negative`);
    assert.ok(label.bottom <= diagram.height, `label.bottom ${label.bottom} exceeds ${diagram.height}`);
  }
  return { route, label };
}

const architecture = {
  kind: "architecture",
  title: "Tiered",
  tiers: [
    { id: "client", label: "Client" },
    { id: "service", label: "Service" },
    { id: "data", label: "Data" },
    { id: "empty", label: "Empty" },
  ],
  nodes: [
    { id: "left", label: "Left", type: "client", tier: "client", width: 140, height: 40 },
    { id: "right", label: "Right", type: "client", tier: "client", width: 180, height: 56 },
    { id: "api", label: "API", type: "service", tier: "service", width: 152, height: 60 },
    { id: "db", label: "DB", type: "database", tier: "data", width: 152, height: 72 },
  ],
  edges: [
    { from: "right", to: "api" },
    { from: "api", to: "db" },
  ],
};

test("layoutArchitecture fits ordered tiers around their members deterministically", () => {
  const normalized = normalizeDiagram(architecture, { layout: "force" });
  const first = layoutArchitecture(normalized);
  const second = layoutArchitecture(normalized);

  assert.deepEqual(first, second);
  assert.deepEqual(first.nodes.map(({ id }) => id), architecture.nodes.map(({ id }) => id));
  assert.deepEqual(first.tiers.map(({ id }) => id), architecture.tiers.map(({ id }) => id));
  assert.ok(first.tiers.every((tier, index) => index === 0 || tier.y > first.tiers[index - 1].y));
  for (const node of first.nodes) {
    const tier = first.tiers.find(({ id }) => id === node.tier);
    assert.ok(node.x >= tier.x && node.x + node.width <= tier.x + tier.width);
    assert.ok(node.y >= tier.y && node.y + node.height <= tier.y + tier.height);
  }
  assertNoOverlap(first.nodes, 20);
  assertFiniteLayout(first);
});

test("both architecture examples retain manual geometry and support force layout", () => {
  for (const example of [ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE]) {
    const manual = layoutDiagram(example);
    assert.deepEqual(
      manual.nodes.map(({ x, y }) => ({ x, y })),
      example.nodes.map(({ x, y }) => ({ x, y })),
    );
    assert.equal(manual.width, example.width);
    assert.equal(manual.height, example.height);
    assert.ok(example.nodes.every(({ tier }) => typeof tier === "string"));

    const forced = layoutDiagram(example, { mode: "force" });
    assertNoOverlap(forced.nodes, 20);
    assert.deepEqual(forced.nodes.map(({ id }) => id), example.nodes.map(({ id }) => id));
    assertFiniteLayout(forced);
  }
});

test("missing flowchart placement keeps fixed nodes and supplied canvas minima", () => {
  const input = {
    kind: "flowchart",
    title: "Mixed",
    width: 920,
    height: 640,
    nodes: [
      { id: "fixed-a", label: "Fixed A", type: "process", x: 50, y: 36 },
      { id: "missing", label: "Missing", type: "process" },
      { id: "fixed-b", label: "Fixed B", type: "process", x: 380, y: 240 },
    ],
    edges: [{ from: "fixed-a", to: "missing" }, { from: "missing", to: "fixed-b" }],
  };

  const result = layoutDiagram(input);
  assert.deepEqual(
    result.nodes.filter(({ id }) => id !== "missing").map(({ id, x, y }) => ({ id, x, y })),
    [{ id: "fixed-a", x: 50, y: 36 }, { id: "fixed-b", x: 380, y: 240 }],
  );
  assert.ok(Number.isFinite(result.nodes[1].x) && Number.isFinite(result.nodes[1].y));
  assert.ok(result.width >= input.width && result.height >= input.height);
  assertNoOverlap(result.nodes, 20);
});

test("missing architecture placement keeps fixed nodes and rebuilds tier bounds", () => {
  const input = {
    kind: "architecture",
    title: "Mixed tiers",
    width: 900,
    height: 400,
    tiers: [{ id: "top", label: "Top" }, { id: "bottom", label: "Bottom" }],
    nodes: [
      { id: "fixed", label: "Fixed", type: "service", tier: "top", x: 700, y: 52 },
      { id: "auto", label: "Auto", type: "database", tier: "bottom" },
    ],
    edges: [{ from: "fixed", to: "auto" }],
  };

  const result = layoutDiagram(input);
  assert.deepEqual(
    { x: result.nodes[0].x, y: result.nodes[0].y },
    { x: input.nodes[0].x, y: input.nodes[0].y },
  );
  for (const node of result.nodes) {
    const tier = result.tiers.find(({ id }) => id === node.tier);
    assert.ok(node.x >= tier.x && node.x + node.width <= tier.x + tier.width);
    assert.ok(node.y >= tier.y && node.y + node.height <= tier.y + tier.height);
  }
  assert.equal(nodeBoundsOverlap(result.tiers[0], result.tiers[1]), false);
  assertNoOverlap(result.nodes, 20);
});

test("manual placement preserves supplied geometry and derives omitted canvas dimensions", () => {
  const supplied = {
    kind: "flowchart",
    title: "Manual",
    width: 720,
    height: 500,
    nodes: [{ id: "one", label: "One", type: "process", x: 100, y: 120 }],
    edges: [],
  };
  assert.deepEqual(
    layoutDiagram(supplied).nodes.map(({ x, y }) => ({ x, y })),
    [{ x: 100, y: 120 }],
  );
  assert.equal(layoutDiagram(supplied).width, supplied.width);
  assert.equal(layoutDiagram(supplied).height, supplied.height);

  const derived = layoutDiagram({ ...supplied, width: undefined, height: undefined });
  assert.equal(derived.width, 100 + 180 + 24);
  assert.equal(derived.height, 120 + 48 + 24);
});

test("manual architecture without tier membership leaves absent tier geometry alone", () => {
  const input = {
    kind: "architecture",
    title: "Manual ungrouped",
    width: 400,
    height: 240,
    tiers: [{ id: "unused", label: "Unused" }],
    nodes: [{ id: "one", label: "One", type: "service", x: 100, y: 80 }],
    edges: [],
  };

  assert.deepEqual(layoutDiagram(input).tiers, input.tiers);
  assert.throws(
    () => prepareDiagram(input),
    /layout-tier-y[\s\S]*unused[\s\S]*layout-tier-height[\s\S]*unused/,
  );
});

test("manual architecture fills only missing tier geometry fields", () => {
  const input = {
    kind: "architecture",
    title: "Partial tier geometry",
    width: 800,
    height: 600,
    tiers: [
      { id: "top", label: "Top", y: 40, height: 120, color: "blue" },
      { id: "bottom", label: "Bottom", x: 30, y: 300, width: 700, height: 150, color: "green" },
    ],
    nodes: [
      { id: "one", label: "One", type: "service", tier: "top", x: 100, y: 70 },
      { id: "two", label: "Two", type: "database", tier: "bottom", x: 200, y: 330 },
    ],
    edges: [{ from: "one", to: "two" }],
  };

  const result = layoutDiagram(input);
  assert.deepEqual(result.tiers[0], {
    ...input.tiers[0],
    x: 12,
    width: 776,
  });
  assert.deepEqual(result.tiers[1], input.tiers[1]);
});

test("omitted canvas dimensions include final and trailing-empty tier bounds", () => {
  const input = {
    kind: "architecture",
    title: "Tier-fitted canvas",
    tiers: [
      { id: "content", label: "Content", x: 12, y: 24, width: 1000, height: 300 },
      { id: "empty", label: "Empty" },
    ],
    nodes: [{ id: "one", label: "One", type: "service", tier: "content", x: 100, y: 80 }],
    edges: [],
  };

  const result = layoutDiagram(input);
  const tail = result.tiers[1];
  assert.equal(result.width, result.tiers[0].x + result.tiers[0].width + 24);
  assert.ok(result.height >= tail.y + tail.height + 24);
  assert.equal(result.tiers[0].width, input.tiers[0].width);
  assert.equal(result.tiers[0].height, input.tiers[0].height);
});

test("manual cyclic flow classifies feedback without moving fixed nodes", () => {
  const input = {
    kind: "flowchart",
    title: "Manual feedback",
    width: 500,
    height: 700,
    nodes: [
      { id: "a", label: "A", type: "process", x: 40, y: 40 },
      { id: "b", label: "B", type: "process", x: 360, y: 220 },
      { id: "c", label: "C", type: "process", x: 900, y: 420 },
    ],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }],
  };

  const result = prepareDiagram(input);
  const maxRight = Math.max(...result.nodes.map((node) => node.x + node.width));
  assert.deepEqual(
    result.nodes.map(({ x, y }) => ({ x, y })),
    input.nodes.map(({ x, y }) => ({ x, y })),
  );
  assert.equal(result.edges[2].route, "feedback");
  assert.ok(result.edges[2].gutterX > maxRight);
  assert.ok(result.width > result.edges[2].gutterX);
  assert.equal(result.height, input.height);
});

test("prepareDiagram aggregates conflicting architecture tier diagnostics", () => {
  const input = {
    kind: "architecture",
    title: "Conflicting manual tiers",
    width: 800,
    height: 500,
    tiers: [
      { id: "top", label: "Top", x: 12, y: 24, width: 776, height: 200 },
      { id: "bottom", label: "Bottom", x: 12, y: 150, width: 776, height: 200 },
    ],
    nodes: [
      { id: "outside", label: "Outside", type: "service", tier: "top", x: 100, y: 300 },
      { id: "inside", label: "Inside", type: "database", tier: "bottom", x: 400, y: 170 },
    ],
    edges: [{ from: "outside", to: "inside" }],
  };

  assert.throws(
    () => prepareDiagram(input),
    /layout-tier-overlap[\s\S]*top, bottom[\s\S]*layout-node-outside-tier[\s\S]*outside, top/,
  );
});

test("prepareDiagram rejects a non-positive effective tier width", () => {
  const input = {
    kind: "architecture",
    title: "Narrow tier canvas",
    width: 20,
    height: 100,
    tiers: [{ id: "narrow", label: "Narrow", y: 10, height: 40 }],
    nodes: [],
    edges: [],
  };

  assert.throws(() => prepareDiagram(input), /layout-tier-width[\s\S]*narrow/);
});

test("mixed placement jumps over an extremely wide fixed reservation", () => {
  const input = {
    kind: "flowchart",
    title: "Wide reservation",
    nodes: [
      { id: "fixed", label: "Fixed", type: "process", width: 1e12, x: 0, y: 148 },
      { id: "auto", label: "Auto", type: "process" },
    ],
    edges: [{ from: "fixed", to: "auto" }],
  };
  const ideal = layoutDiagram(input, { mode: "force" });
  const idealX = ideal.nodes.find(({ id }) => id === "auto").x;
  const firstRightCandidate = idealX + Math.ceil((1e12 + 20 - idealX) / 20) * 20;

  const result = layoutDiagram(input);
  const auto = result.nodes.find(({ id }) => id === "auto");
  assert.equal(auto.x, firstRightCandidate);
  assert.ok(Number.isFinite(auto.x) && Number.isFinite(auto.y));
  assert.equal(nodeBoundsOverlap(result.nodes[0], auto, 20), false);
});

test("force placement ignores old coordinates and tightly fits its result", () => {
  const input = {
    kind: "flowchart",
    title: "Forced",
    width: 5000,
    height: 4000,
    nodes: [
      { id: "a", label: "A", type: "process", x: 2000, y: 2000 },
      { id: "b", label: "B", type: "process", x: 2500, y: 2500 },
    ],
    edges: [{ from: "a", to: "b" }],
  };
  const result = layoutDiagram(input, { mode: "force" });

  assert.notDeepEqual(result.nodes.map(({ x, y }) => ({ x, y })), input.nodes.map(({ x, y }) => ({ x, y })));
  assert.ok(result.width < input.width && result.height < input.height);
  assertFiniteLayout(result);
});

test("force layout fits a long cyclic feedback label pill inside the canvas", () => {
  const result = layoutDiagram(longFeedbackFlow(), { mode: "force" });

  assertFeedbackLabelPillFits(result);
});

test("forced preparation fits a long cyclic feedback label pill inside the canvas", () => {
  const result = prepareDiagram(longFeedbackFlow(), { layout: "force" });

  assertFeedbackLabelPillFits(result);
});

test("missing, mixed, and force layouts retain scene padding around feedback", () => {
  const mixed = longFeedbackFlow();
  mixed.nodes[0] = { ...mixed.nodes[0], x: 20, y: 20 };
  const results = [
    layoutDiagram(longFeedbackFlow()),
    layoutDiagram(mixed),
    layoutDiagram(longFeedbackFlow(), { mode: "force" }),
  ];

  results.forEach((result) => assertFeedbackScenePadding(result));
});

test("manual self-loop expands the canvas for its path and label bounds", () => {
  const result = prepareDiagram({
    kind: "flowchart",
    title: "Bottom self loop",
    width: 120,
    height: 100,
    nodes: [{ id: "self", label: "Self", type: "process", x: 20, y: 70, width: 20, height: 20 }],
    edges: [{ from: "self", to: "self", label: "again" }],
  });

  assert.ok(result.height > 100);
  assertFeedbackScenePadding(result);
});

test("tiny manual self-loop refits its gutter from the current nodes", () => {
  const result = prepareDiagram({
    kind: "flowchart",
    title: "Compact self loop",
    width: 120,
    height: 80,
    nodes: [{ id: "self", label: "Self", type: "process", x: 20, y: 0, width: 20, height: 20 }],
    edges: [{ from: "self", to: "self", label: "again" }],
  });

  assert.equal(result.edges[0].gutterX, 100);
  assert.ok(result.width < 250);
  assertFeedbackScenePadding(result);
});

test("prepareDiagram aggregates non-finite derived node and feedback geometry", () => {
  const input = {
    kind: "flowchart",
    title: "Overflowing geometry",
    nodes: [{
      id: "overflow",
      label: "Overflow",
      type: "process",
      x: Number.MAX_VALUE,
      y: 20,
      width: Number.MAX_VALUE,
      height: 20,
    }],
    edges: [{ from: "overflow", to: "overflow", label: "again" }],
  };

  assert.throws(() => prepareDiagram(input), (error) => {
    assert.match(error.message, /layout-canvas-width/);
    assert.match(error.message, /layout-node-right[\s\S]*overflow/);
    assert.match(error.message, /layout-feedback-gutter/);
    assert.match(error.message, /layout-feedback-control/);
    assert.match(error.message, /layout-feedback-label-bounds/);
    return true;
  });
});

test("prepareDiagram accepts large derived geometry that remains finite", () => {
  const result = prepareDiagram({
    kind: "flowchart",
    title: "Large finite geometry",
    nodes: [{ id: "large", label: "Large", type: "process", x: 1e300, y: 20, width: 1e300, height: 20 }],
    edges: [],
  });

  assert.ok(Number.isFinite(result.width));
  assert.ok(Number.isFinite(result.nodes[0].x + result.nodes[0].width));
});

test("prepareDiagram rejects non-finite derived geometry on an ordinary explicit-anchor edge", () => {
  assert.throws(() => prepareDiagram(overflowingExplicitEdgeFlow()), (error) => {
    assert.match(error.message, /layout-edge-control/);
    assert.match(error.message, /layout-edge-path-bounds/);
    assert.match(error.message, /layout-edge-label-bounds/);
    return true;
  });
});

test("prepareDiagram accepts finite explicit-anchor edge geometry", () => {
  const result = prepareDiagram({
    kind: "flowchart",
    title: "Finite explicit edge",
    width: 400,
    height: 200,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 20, y: 80, width: 80, height: 40 },
      { id: "right", label: "Right", type: "process", x: 240, y: 80, width: 80, height: 40 },
    ],
    edges: [{ from: "left", to: "right", label: "event", fromAnchor: "right", toAnchor: "left" }],
  });
  const edge = result.edges[0];
  const nodeMap = new Map(result.nodes.map((node) => [node.id, node]));
  const route = routeEdge(nodeMap.get(edge.from), nodeMap.get(edge.to), edge);

  assert.ok(Object.values(route.points).flat().every(Number.isFinite));
});

test("prepareDiagram keeps a top short-edge label inside a fixed manual canvas", () => {
  const input = {
    kind: "flowchart",
    title: "Top short edge",
    width: 400,
    height: 100,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 0, y: 10, width: 180, height: 48 },
      { id: "right", label: "Right", type: "process", x: 200, y: 10, width: 180, height: 48 },
    ],
    edges: [{ from: "left", to: "right", label: "event" }],
  };

  const prepared = prepareDiagram(input);
  const { label } = assertOrdinaryEdgeFits(prepared);

  assert.deepEqual(
    prepared.nodes.map(({ x, y }) => ({ x, y })),
    input.nodes.map(({ x, y }) => ({ x, y })),
  );
  assert.ok(label.top >= 0);
  assert.deepEqual(prepareDiagram(prepared), prepared);
});

test("prepareDiagram constrains outward explicit-anchor controls without changing endpoint sides", () => {
  const input = {
    kind: "flowchart",
    title: "Outward anchors",
    width: 400,
    height: 100,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 0, y: 10, width: 180, height: 48 },
      { id: "right", label: "Right", type: "process", x: 200, y: 10, width: 180, height: 48 },
    ],
    edges: [{
      from: "left",
      to: "right",
      label: "outward",
      fromAnchor: "left",
      toAnchor: "right",
    }],
  };

  const prepared = prepareDiagram(input);
  const { route } = assertOrdinaryEdgeFits(prepared);

  assert.equal(route.fromAnchor, "left");
  assert.equal(route.toAnchor, "right");
  assert.deepEqual(route.points.start, [0, 34]);
  assert.deepEqual(route.points.end, [380, 34]);
  assert.deepEqual(
    prepared.nodes.map(({ x, y }) => ({ x, y })),
    input.nodes.map(({ x, y }) => ({ x, y })),
  );
  assert.deepEqual(prepareDiagram(prepared), prepared);
});

test("ordinary edge fitting remains idempotent when a later label expands the canvas", () => {
  const input = {
    kind: "flowchart",
    title: "Ordered edge fitting",
    width: 400,
    height: 100,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 0, y: 10, width: 80, height: 48 },
      { id: "right", label: "Right", type: "process", x: 300, y: 10, width: 80, height: 48 },
    ],
    edges: [
      { from: "left", to: "right", fromAnchor: "left", toAnchor: "right" },
      { from: "left", to: "right", label: "A later label that deliberately widens the prepared canvas ".repeat(2) },
    ],
  };

  const prepared = prepareDiagram(input);

  assert.ok(prepared.width > input.width);
  prepared.edges.forEach((edge) => assertOrdinaryEdgeFits(prepared, edge));
  assert.deepEqual(prepareDiagram(prepared), prepared);
});

test("bounded ordinary edge geometry survives JSON and structured-clone round trips", () => {
  const input = {
    kind: "flowchart",
    title: "Round-tripped bounded edges",
    width: 400,
    height: 100,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 0, y: 10, width: 180, height: 48 },
      { id: "right", label: "Right", type: "process", x: 200, y: 10, width: 180, height: 48 },
    ],
    edges: [
      { from: "left", to: "right", label: "event" },
      {
        from: "left",
        to: "right",
        label: "outward",
        fromAnchor: "left",
        toAnchor: "right",
      },
    ],
  };
  const prepared = prepareDiagram(input);

  prepared.edges.forEach((edge) => {
    for (const field of ["control1", "control2", "labelPoint"]) {
      assert.equal(Object.hasOwn(edge, field), false, `${field} leaked into a prepared edge`);
    }
  });

  for (const roundTripped of [JSON.parse(JSON.stringify(prepared)), structuredClone(prepared)]) {
    const reparsed = prepareDiagram(roundTripped);
    reparsed.edges.forEach((edge) => assertOrdinaryEdgeFits(reparsed, edge));
    assert.deepEqual(
      reparsed.nodes.map(({ x, y }) => ({ x, y })),
      input.nodes.map(({ x, y }) => ({ x, y })),
    );
    assert.equal(reparsed.edges[1].fromAnchor, "left");
    assert.equal(reparsed.edges[1].toAnchor, "right");
  }
});

test("prepareDiagram lays out a coordinate-free feedback flow with metadata", () => {
  const input = {
    kind: "flowchart",
    title: "Feedback",
    nodes: [
      { id: "a", label: "A", type: "process" },
      { id: "b", label: "B", type: "process" },
      { id: "c", label: "C", type: "process" },
    ],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "a" }],
  };
  const first = prepareDiagram(input);
  const second = prepareDiagram(input);

  assert.deepEqual(first, second);
  assert.equal(first.edges[2].route, "feedback");
  assert.ok(first.edges[2].gutterX > Math.max(...first.nodes.map((node) => node.x + node.width)));
});

test("prepareDiagram can deterministically re-prepare its own internal edge metadata", () => {
  const input = {
    kind: "flowchart",
    title: "Repeatable feedback",
    nodes: [
      { id: "a", label: "A", type: "process" },
      { id: "b", label: "B", type: "process" },
    ],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
  };
  const prepared = prepareDiagram(input);
  const expected = structuredClone(prepared);
  prepared.edges[1].gutterX = 1e12;

  assert.deepEqual(prepareDiagram(prepared), expected);
  assert.ok(validateDiagram(prepared).some(({ code, path }) => (
    code === "unknown-edge-field" && path === "edges[1].route"
  )));
  assert.ok(validateDiagram(prepared).some(({ code, path }) => (
    code === "unknown-edge-field" && path === "edges[1].gutterX"
  )));
});

test("layoutDiagram can re-layout its own force-layout feedback metadata", () => {
  const input = {
    kind: "flowchart",
    title: "Force feedback",
    nodes: [
      { id: "a", label: "A", type: "process" },
      { id: "b", label: "B", type: "process" },
    ],
    edges: [{ from: "a", to: "b" }, { from: "b", to: "a" }],
  };
  const first = layoutDiagram(input, { mode: "force" });

  assert.deepEqual(layoutDiagram(first, { mode: "force" }), first);
});

test("prepareDiagram keeps a long feedback label pill inside the canvas", () => {
  const input = {
    kind: "flowchart",
    title: "Long feedback label",
    nodes: [
      { id: "a", label: "A", type: "process" },
      { id: "b", label: "B", type: "process" },
    ],
    edges: [
      { from: "a", to: "b" },
      {
        from: "b",
        to: "a",
        label: "Return to the beginning after the reviewer requests another complete revision cycle and include every required follow-up note before requesting one more review",
      },
    ],
  };
  const prepared = prepareDiagram(input);
  const edge = prepared.edges[1];
  const nodeMap = new Map(prepared.nodes.map((node) => [node.id, node]));
  const route = routeEdge(nodeMap.get(edge.from), nodeMap.get(edge.to), edge);
  const width = Math.max(36, edge.label.length * 6.2 + 14);

  assert.ok(route.labelPoint[0] - width / 2 >= 0);
  assert.ok(route.labelPoint[0] + width / 2 <= prepared.width);
});

test("layout orchestration never mutates deep-frozen input", () => {
  const input = deepFreeze(structuredClone(architecture));
  const before = structuredClone(input);
  layoutDiagram(input, { mode: "force" });
  assert.deepEqual(input, before);
});

test("prepareDiagram reports every fixed-node overlap with layout codes", () => {
  const input = {
    kind: "flowchart",
    title: "Overlap",
    width: 500,
    height: 300,
    nodes: [
      { id: "a", label: "A", type: "process", x: 50, y: 50 },
      { id: "b", label: "B", type: "process", x: 100, y: 70 },
      { id: "c", label: "C", type: "process", x: 120, y: 80 },
    ],
    edges: [],
  };
  assert.throws(() => prepareDiagram(input), (error) => {
    assert.match(
      error.message,
      /layout-node-overlap[\s\S]*a, b[\s\S]*layout-node-overlap[\s\S]*a, c[\s\S]*layout-node-overlap[\s\S]*b, c/,
    );
    assert.doesNotMatch(error.message, /layout-layout-/);
    return true;
  });
});

test("layout mode and architecture tier errors are actionable", () => {
  assert.throws(() => layoutDiagram(architecture, { mode: "sideways" }), /mode[\s\S]*missing[\s\S]*force/);
  assert.throws(
    () => layoutDiagram({ ...architecture, nodes: [{ ...architecture.nodes[0], tier: undefined }] }, { mode: "force" }),
    /missing-node-tier/,
  );
  assert.throws(
    () => layoutDiagram({ ...architecture, nodes: [{ ...architecture.nodes[0], tier: "ghost" }] }, { mode: "force" }),
    /unknown-node-tier/,
  );
});

test("layoutDiagram handles empty graphs safely", () => {
  for (const diagram of [
    { kind: "flowchart", title: "Empty", nodes: [], edges: [] },
    { kind: "architecture", title: "Empty", tiers: [], nodes: [], edges: [] },
  ]) {
    const result = layoutDiagram(diagram, { mode: "force" });
    assert.deepEqual(result.nodes, []);
    assertFiniteLayout(result);
  }
});
