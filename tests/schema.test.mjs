import test from "node:test";
import assert from "node:assert/strict";

import {
  assertDiagram,
  normalizeDiagram,
  validateDiagram,
} from "../src/diagram/schema.js";

const validDiagram = {
  kind: "flowchart",
  title: "Login",
  width: 640,
  height: 480,
  nodes: [
    { id: "start", label: "Start", type: "terminal", x: 250, y: 40 },
    { id: "auth", label: "Authenticate", type: "process", x: 240, y: 160 },
  ],
  edges: [{ from: "start", to: "auth", label: "submit" }],
};

test("normalizeDiagram applies canonical node sizes and edge defaults", () => {
  const normalized = normalizeDiagram(validDiagram);

  assert.deepEqual(
    normalized.nodes.map(({ id, width, height }) => ({ id, width, height })),
    [
      { id: "start", width: 140, height: 44 },
      { id: "auth", width: 180, height: 48 },
    ],
  );
  assert.equal(normalized.edges[0].dashed, false);
  assert.equal(normalized.nodes[0].shape, "terminal");
});

test("normalizeDiagram supports per-diagram node defaults without hiding node overrides", () => {
  const normalized = normalizeDiagram({
    ...validDiagram,
    nodeDefaults: { width: 152, height: 56 },
    nodes: [
      { id: "one", label: "One", type: "service", x: 10, y: 10 },
      { id: "two", label: "Two", type: "service", x: 200, y: 10, width: 200 },
    ],
    edges: [{ from: "one", to: "two" }],
  });

  assert.deepEqual(
    normalized.nodes.map(({ width, height }) => ({ width, height })),
    [{ width: 152, height: 56 }, { width: 200, height: 56 }],
  );
});

test("validateDiagram reports duplicate ids and dangling edges together", () => {
  const issues = validateDiagram({
    ...validDiagram,
    nodes: [validDiagram.nodes[0], { ...validDiagram.nodes[0] }],
    edges: [{ from: "start", to: "missing" }],
  });

  assert.deepEqual(issues.map((issue) => issue.code), ["duplicate-node-id", "missing-edge-target"]);
});

test("validateDiagram rejects unsupported diagram kinds and invalid dimensions", () => {
  const issues = validateDiagram({
    ...validDiagram,
    kind: "mindmap",
    width: 0,
    height: -1,
  });

  assert.deepEqual(issues.map((issue) => issue.code), [
    "invalid-kind",
    "invalid-width",
    "invalid-height",
  ]);
});

test("assertDiagram throws one actionable error containing every issue", () => {
  assert.throws(
    () => assertDiagram({ ...validDiagram, edges: [{ from: "ghost", to: "missing" }] }),
    /missing-edge-source[\s\S]*missing-edge-target/,
  );
});
