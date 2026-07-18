import test from "node:test";
import assert from "node:assert/strict";

import { normalizeDiagram } from "../src/diagram/schema.js";
import { LOGIN_FLOW } from "../examples/diagrams.js";
import { analyzeGraph, orderRanks } from "../src/diagram/layout/graph.js";
import { layoutFlowchart } from "../src/diagram/layout/flowchart.js";

function deepFreeze(value) {
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const cycleNodes = [
  { id: "start", width: 120, height: 40 },
  { id: "input", width: 140, height: 48 },
  { id: "valid", width: 140, height: 52 },
  { id: "error", width: 150, height: 44 },
];
const cycleEdges = [
  { from: "start", to: "input" },
  { from: "input", to: "valid" },
  { from: "valid", to: "error" },
  { from: "error", to: "input" },
];

function rankIds(rankOrder) {
  return rankOrder.map((rank) => rank.map(({ id }) => id));
}

test("analyzeGraph identifies a DFS back edge and assigns main-flow ranks", () => {
  const analysis = analyzeGraph(cycleNodes, cycleEdges);

  assert.deepEqual([...analysis.feedbackEdgeIndexes], [3]);
  assert.deepEqual([...analysis.ranks], [
    ["start", 0], ["input", 1], ["valid", 2], ["error", 3],
  ]);
});

test("analyzeGraph treats a self-loop as feedback", () => {
  const analysis = analyzeGraph([{ id: "only" }], [{ from: "only", to: "only" }]);

  assert.deepEqual([...analysis.feedbackEdgeIndexes], [0]);
  assert.deepEqual([...analysis.ranks], [["only", 0]]);
});

test("orderRanks keeps branches deterministic across barycenter sweeps", () => {
  const nodes = [
    { id: "start" }, { id: "right" }, { id: "left" }, { id: "join" },
  ];
  const edges = [
    { from: "start", to: "right" }, { from: "start", to: "left" },
    { from: "right", to: "join" }, { from: "left", to: "join" },
  ];
  const { ranks, feedbackEdgeIndexes } = analyzeGraph(nodes, edges);
  const first = orderRanks(nodes, edges, ranks, feedbackEdgeIndexes);
  const second = orderRanks(nodes, edges, ranks, feedbackEdgeIndexes);

  assert.equal(first[1][0], nodes[1]);
  assert.deepEqual(rankIds(first), [["start"], ["right", "left"], ["join"]]);
  assert.deepEqual(second, first);
});

test("orderRanks ignores rank-skipping edges during adjacent-rank barycenter sweeps", () => {
  const nodes = [
    { id: "root" }, { id: "p0" }, { id: "p1" }, { id: "p2" }, { id: "a" }, { id: "b" },
  ];
  const edges = [
    { from: "root", to: "p0" }, { from: "root", to: "p1" }, { from: "root", to: "p2" },
    { from: "p2", to: "a" }, { from: "p1", to: "b" }, { from: "root", to: "a" },
  ];
  const { ranks, feedbackEdgeIndexes } = analyzeGraph(nodes, edges);
  const ordered = orderRanks(nodes, edges, ranks, feedbackEdgeIndexes);

  assert.deepEqual(rankIds(ordered)[2], ["b", "a"]);
});

test("analyzeGraph retains disconnected nodes in source order", () => {
  const nodes = [{ id: "a" }, { id: "b" }, { id: "lonely" }, { id: "c" }];
  const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }];
  const analysis = analyzeGraph(nodes, edges);

  assert.deepEqual([...analysis.ranks], [["a", 0], ["b", 1], ["lonely", 0], ["c", 2]]);
  assert.deepEqual(rankIds(orderRanks(nodes, edges, analysis.ranks, analysis.feedbackEdgeIndexes)), [
    ["a", "lonely"], ["b"], ["c"],
  ]);
});

test("layoutFlowchart lays ranks top-to-bottom and reserves a feedback gutter", () => {
  const diagram = { kind: "flowchart", title: "Cycle", nodes: cycleNodes, edges: cycleEdges };
  const laidOut = layoutFlowchart(diagram);
  const byId = new Map(laidOut.nodes.map((node) => [node.id, node]));
  const maxRight = Math.max(...laidOut.nodes.map((node) => node.x + node.width));

  assert.ok(byId.get("start").y < byId.get("input").y);
  assert.ok(byId.get("input").y < byId.get("valid").y);
  assert.ok(byId.get("valid").y < byId.get("error").y);
  assert.ok(laidOut.edges[3].gutterX > maxRight);
  assert.equal(laidOut.edges[3].route, "feedback");
  assert.deepEqual(laidOut.edges.slice(0, 3), cycleEdges.slice(0, 3));
  assert.ok(laidOut.width > 0 && laidOut.height > 0);
  assert.ok(laidOut.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y)));
});

test("layoutFlowchart identifies both LOGIN_FLOW returns and is deeply deterministic", () => {
  const normalized = normalizeDiagram(LOGIN_FLOW);
  const first = layoutFlowchart(normalized);
  const second = layoutFlowchart(normalized);

  assert.deepEqual(first, second);
  assert.deepEqual(
    first.edges.map((edge, index) => edge.route === "feedback" ? index : null).filter((index) => index !== null),
    [4, 8],
  );
});

test("layout operations do not mutate deep-frozen inputs", () => {
  const diagram = deepFreeze({ kind: "flowchart", title: "Frozen", nodes: cycleNodes, edges: cycleEdges });
  const before = structuredClone(diagram);

  const analysis = analyzeGraph(diagram.nodes, diagram.edges);
  const ordered = orderRanks(diagram.nodes, diagram.edges, analysis.ranks, analysis.feedbackEdgeIndexes);
  const laidOut = layoutFlowchart(diagram);

  assert.deepEqual(diagram, before);
  assert.notEqual(laidOut.nodes[0], diagram.nodes[0]);
  assert.deepEqual(rankIds(ordered), [["start"], ["input"], ["valid"], ["error"]]);
});

test("layoutFlowchart handles an empty graph safely", () => {
  const laidOut = layoutFlowchart({ kind: "flowchart", title: "Empty", nodes: [], edges: [] });

  assert.deepEqual(laidOut.nodes, []);
  assert.deepEqual(laidOut.edges, []);
  assert.ok(Number.isFinite(laidOut.width) && laidOut.width > 0);
  assert.ok(Number.isFinite(laidOut.height) && laidOut.height > 0);
});
