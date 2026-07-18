import test from "node:test";
import assert from "node:assert/strict";

import {
  anchorPoint,
  cubicPoint,
  edgeLabelMetrics,
  nodeBoundsOverlap,
  routeEdge,
  validateLayout,
} from "../src/diagram/geometry.js";

const top = { id: "top", x: 100, y: 40, width: 120, height: 60 };
const bottom = { id: "bottom", x: 300, y: 240, width: 120, height: 60 };

test("anchorPoint resolves all four node boundaries", () => {
  assert.deepEqual(anchorPoint(top, "top"), [160, 40]);
  assert.deepEqual(anchorPoint(top, "right"), [220, 70]);
  assert.deepEqual(anchorPoint(top, "bottom"), [160, 100]);
  assert.deepEqual(anchorPoint(top, "left"), [100, 70]);
});

test("routeEdge builds a true cubic path and places its label on the curve", () => {
  const route = routeEdge(top, bottom, {});

  assert.equal(route.fromAnchor, "bottom");
  assert.equal(route.toAnchor, "top");
  assert.match(route.d, /^M 160 100 C 160 158\.8 360 181\.2 360 240$/);
  assert.deepEqual(route.labelPoint, cubicPoint(route.points, 0.5));
});

test("routeEdge respects explicit horizontal anchors", () => {
  const route = routeEdge(top, bottom, { fromAnchor: "right", toAnchor: "left" });

  assert.equal(route.d, "M 220 70 C 319.0870324512749 70 200.9129675487251 270 300 270");
});

test("routeEdge keeps short horizontal curves inside the gap between nodes", () => {
  const left = { id: "left", x: 0, y: 20, width: 100, height: 40 };
  const right = { id: "right", x: 120, y: 20, width: 100, height: 40 };
  const route = routeEdge(left, right);

  assert.equal(route.d, "M 100 40 C 110 40 110 40 120 40");
});

test("routeEdge sends feedback edges through the right-side gutter", () => {
  const route = routeEdge(bottom, top, { route: "feedback", gutterX: 500 });

  assert.equal(route.fromAnchor, "right");
  assert.equal(route.toAnchor, "right");
  assert.equal(route.d, "M 420 270 C 500 270 500 70 220 70");
  assert.deepEqual(route.points, {
    start: [420, 270],
    control1: [500, 270],
    control2: [500, 70],
    end: [220, 70],
  });
  assert.deepEqual(route.labelPoint, cubicPoint(route.points, 0.5));
});

test("routeEdge gives a feedback self-loop a visible downward arc", () => {
  const node = { id: "self", x: 20, y: 0, width: 20, height: 20 };
  const route = routeEdge(node, node, { route: "feedback", gutterX: 200 });

  assert.deepEqual(route.points.start, [40, 10]);
  assert.deepEqual(route.points.end, route.points.start);
  assert.ok(route.points.control1[1] >= route.points.start[1] + 48);
  assert.equal(route.points.control2[1], route.points.control1[1]);
  assert.deepEqual(route.labelPoint, cubicPoint(route.points, 0.5));
  assert.notEqual(route.points.control1[1], route.points.start[1]);
});

test("routeEdge derives a finite feedback gutter when gutterX is missing or invalid", () => {
  for (const gutterX of [undefined, Number.NaN, Number.POSITIVE_INFINITY, "far-right"]) {
    const route = routeEdge(bottom, top, { route: "feedback", gutterX });
    assert.doesNotMatch(route.d, /NaN|Infinity/);
    assert.ok(route.points.control1[0] >= 448);
    assert.deepEqual(route.labelPoint, cubicPoint(route.points, 0.5));
  }
});

test("edgeLabelMetrics keeps ASCII labels near the existing visual width", () => {
  const metrics = edgeLabelMetrics("Event");

  assert.ok(metrics.textLength >= 30.5 && metrics.textLength <= 31.5);
  assert.ok(metrics.width >= 44.5 && metrics.width <= 45.5);
});

test("edgeLabelMetrics budgets about one em for every CJK grapheme", () => {
  const metrics = edgeLabelMetrics("流程回退标签");

  assert.ok(metrics.textLength >= 59 && metrics.textLength <= 61);
  assert.ok(metrics.width >= 73 && metrics.width <= 75);
});

test("edgeLabelMetrics counts a family ZWJ emoji as one grapheme", () => {
  const metrics = edgeLabelMetrics("👨‍👩‍👧‍👦");

  assert.ok(metrics.textLength >= 9 && metrics.textLength <= 11);
  assert.equal(metrics.width, 36);
});

test("edgeLabelMetrics does not double-count a combining mark", () => {
  const metrics = edgeLabelMetrics("e\u0301");

  assert.ok(metrics.textLength >= 6 && metrics.textLength <= 7);
  assert.equal(metrics.width, 36);
});

test("nodeBoundsOverlap honors the requested safety gap", () => {
  const near = { x: 239, y: 40, width: 80, height: 60 };
  const far = { x: 241, y: 40, width: 80, height: 60 };

  assert.equal(nodeBoundsOverlap(top, near, 20), true);
  assert.equal(nodeBoundsOverlap(top, far, 20), false);
});

test("validateLayout reports out-of-bounds and overlapping nodes", () => {
  const issues = validateLayout({
    width: 400,
    height: 300,
    nodes: [
      { id: "outside", x: -1, y: 10, width: 100, height: 40 },
      { id: "one", x: 120, y: 120, width: 100, height: 40 },
      { id: "two", x: 210, y: 120, width: 100, height: 40 },
    ],
  }, { padding: 0, gap: 0 });

  assert.deepEqual(issues.map((issue) => issue.code), ["layout-node-out-of-bounds", "layout-node-overlap"]);
});
