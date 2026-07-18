import test from "node:test";
import assert from "node:assert/strict";

import {
  anchorPoint,
  cubicPoint,
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

  assert.deepEqual(issues.map((issue) => issue.code), ["node-out-of-bounds", "node-overlap"]);
});
