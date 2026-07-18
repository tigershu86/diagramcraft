import test from "node:test";
import assert from "node:assert/strict";

import {
  DiagramDocument,
  documentMetrics,
  resolvedLegend,
} from "../src/diagram/DiagramDocument.js";
import { renderDiagramSvg, safeDiagramFilename } from "../src/diagram/export.js";
import { prepareDiagram } from "../src/diagram/layout/index.js";

const exportDiagram = {
  kind: "flowchart",
  title: "Approval & delivery",
  subtitle: "Export <ready>",
  width: 420,
  height: 260,
  nodes: [
    { id: "start", label: "Start & review", type: "terminal", x: 140, y: 20 },
    { id: "approve", label: "Approved <now>?", type: "decision", x: 135, y: 130 },
  ],
  edges: [{ from: "start", to: "approve", label: "review > approve" }],
  legend: [
    { type: "terminal", label: "Start & finish" },
    "decision",
    { type: "process", label: "Work <step>" },
  ],
};

test("documentMetrics reserves title, scene, and multi-row legend bands", () => {
  const metrics = documentMetrics(exportDiagram);

  assert.deepEqual(metrics, {
    width: 420,
    height: 424,
    titleBand: 76,
    sceneY: 76,
    legendY: 336,
    legendHeight: 88,
    columns: 2,
    rows: 2,
  });
});

test("documentMetrics omits optional bands for a title-only diagram with no legend", () => {
  const metrics = documentMetrics({
    ...exportDiagram,
    subtitle: "",
    legend: [],
    nodes: [],
  });

  assert.deepEqual(metrics, {
    width: 420,
    height: 318,
    titleBand: 58,
    sceneY: 58,
    legendY: 318,
    legendHeight: 0,
    columns: 2,
    rows: 0,
  });
});

test("resolvedLegend preserves explicit items and infers first-seen node types", () => {
  const explicit = [{ type: "database", label: "Storage" }, "client", "database"];
  assert.deepEqual(resolvedLegend({ ...exportDiagram, legend: explicit }), explicit);
  assert.deepEqual(resolvedLegend({
    ...exportDiagram,
    legend: [],
    nodes: [
      { id: "a", type: "service" },
      { id: "b", type: "database" },
      { id: "c", type: "service" },
      { id: "d", type: "queue" },
    ],
  }), ["service", "database", "queue"]);
});

test("safeDiagramFilename keeps Unicode and removes unsafe filename characters", () => {
  assert.equal(safeDiagramFilename("用户 / 登录流程", "svg"), "用户-登录流程.svg");
  assert.equal(safeDiagramFilename("  Diagram:*?  ", "png"), "Diagram.png");
  assert.equal(safeDiagramFilename(" \u0000 /:*?\"<>| ", "svg"), "diagram.svg");
});

test("renderDiagramSvg emits a complete standalone SVG document with SVG legend", () => {
  const svg = renderDiagramSvg(exportDiagram);

  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?><svg'));
  assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<svg[^>]+width="420"[^>]+height="424"[^>]+viewBox="0 0 420 424"[^>]+role="img"/);
  assert.match(svg, /aria-labelledby="export-title export-description"/);
  assert.match(svg, /<title id="export-title">Approval &amp; delivery<\/title>/);
  assert.match(svg, /<desc id="export-description">Export &lt;ready&gt;<\/desc>/);
  assert.match(svg, /<text[^>]+y="30"[^>]+font-size="22"[^>]+font-weight="700"[^>]*>Approval &amp; delivery<\/text>/);
  assert.match(svg, /<text[^>]+y="52"[^>]+font-size="12"[^>]*>Export &lt;ready&gt;<\/text>/);
  assert.match(svg, /<g transform="translate\(0 76\)">/);
  assert.match(svg, /<g transform="translate\(0 336\)">/);
  assert.match(svg, /<circle[^>]+r="5"[^>]+fill="#0F172A"/);
  assert.match(svg, />Start &amp; finish<\/text>/);
  assert.match(svg, />decision<\/text>/);
  assert.match(svg, />Work &lt;step&gt;<\/text>/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
});

test("renderDiagramSvg lays out and exports a coordinate-free diagram", () => {
  const svg = renderDiagramSvg({
    kind: "flowchart",
    title: "Coordinate-free",
    nodes: [
      { id: "start", label: "Start", type: "terminal" },
      { id: "finish", label: "Finish", type: "terminal" },
    ],
    edges: [{ from: "start", to: "finish" }],
  });
  const viewBox = svg.match(/viewBox="0 0 ([^"]+) ([^"]+)"/);

  assert.ok(viewBox);
  assert.ok(Number.isFinite(Number(viewBox[1])) && Number(viewBox[1]) > 0);
  assert.ok(Number.isFinite(Number(viewBox[2])) && Number(viewBox[2]) > 0);
  assert.match(svg, />Start<\/text>/);
  assert.match(svg, />Finish<\/text>/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
});

test("renderDiagramSvg accepts a prepared cycle and keeps its finite feedback path", () => {
  const prepared = prepareDiagram({
    kind: "flowchart",
    title: "Prepared cycle",
    nodes: [
      { id: "first", label: "First", type: "process" },
      { id: "second", label: "Second", type: "process" },
    ],
    edges: [{ from: "first", to: "second" }, { from: "second", to: "first", label: "again" }],
  });
  const svg = renderDiagramSvg(prepared);

  assert.match(svg, /M 410 172 C 470 172 470 60 410 60/);
  assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
});

test("renderDiagramSvg excludes preview-only interaction and HTML", () => {
  const svg = renderDiagramSvg(exportDiagram);

  assert.doesNotMatch(svg, /role="button"/);
  assert.doesNotMatch(svg, /tabindex=/i);
  assert.doesNotMatch(svg, /aria-pressed=/i);
  assert.doesNotMatch(svg, /foreignObject/i);
  assert.doesNotMatch(svg, /on(?:mouse|focus|blur|click|key)[a-z]*=/i);
  assert.doesNotMatch(svg, /cursor\s*:/i);
  assert.doesNotMatch(svg, /transition\s*:/i);
  assert.match(svg, /<svg[^>]+role="img"/);
  assert.match(svg, /id="export-arrow"/);
  assert.match(svg, /id="export-clip-start"/);
});

test("renderDiagramSvg escapes XML-sensitive diagram text", () => {
  const svg = renderDiagramSvg(exportDiagram);

  assert.match(svg, />Start &amp; review<\/text>/);
  assert.match(svg, />Approved &lt;now&gt;\?<\/text>/);
  assert.match(svg, />review &gt; approve<\/text>/);
  assert.doesNotMatch(svg, />[^<]*Start & review/);
});

test("DiagramDocument remains a renderable public component", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const React = await import("react");
  const prepared = prepareDiagram(exportDiagram);
  const svg = renderToStaticMarkup(React.createElement(DiagramDocument, { diagram: prepared }));

  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<g transform="translate\(0 76\)">/);
});
