import test from "node:test";
import assert from "node:assert/strict";

import { ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE } from "../examples/diagrams.js";
import { nodeBoundsOverlap } from "../src/diagram/geometry.js";
import { layoutArchitecture } from "../src/diagram/layout/architecture.js";
import { layoutDiagram, prepareDiagram } from "../src/diagram/layout/index.js";
import { normalizeDiagram } from "../src/diagram/schema.js";

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
      { id: "fixed", label: "Fixed", type: "service", tier: "top", x: 700, y: 80 },
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
  assert.ok(result.tiers[0].y < result.tiers[1].y);
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
  assert.throws(
    () => prepareDiagram(input),
    /layout-node-overlap[\s\S]*a, b[\s\S]*layout-node-overlap[\s\S]*a, c[\s\S]*layout-node-overlap[\s\S]*b, c/,
  );
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
