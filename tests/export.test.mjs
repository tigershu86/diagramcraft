import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DiagramDocument,
  documentMetrics,
  resolvedLegend,
} from "../src/diagram/DiagramDocument.js";
import { renderDiagramSvg, safeDiagramFilename } from "../src/diagram/export.js";
import { prepareDiagram } from "../src/diagram/layout/index.js";

const EXPORT_ID_PREFIX = "svg-65-78-70-6f-72-74";

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
    sceneX: 0,
    legendY: 336,
    legendHeight: 88,
    columns: 2,
    rows: 2,
    columnWidth: 186,
    titleTextWidth: 372,
    subtitleTextWidth: 372,
    legendTextWidth: 168,
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
    sceneX: 0,
    legendY: 318,
    legendHeight: 0,
    columns: 2,
    rows: 0,
    columnWidth: 186,
    titleTextWidth: 372,
    subtitleTextWidth: 372,
    legendTextWidth: 168,
  });
});

test("documentMetrics widens a narrow scene and constrains document text cells", () => {
  const metrics = documentMetrics({
    kind: "flowchart",
    title: "A very long heading that must remain inside the exported document",
    subtitle: "A very long subtitle that must also remain inside the exported document",
    width: 40,
    height: 40,
    nodes: [],
    edges: [],
    tiers: [],
    legend: [{ type: "process", label: "A very long legend label that cannot overflow" }],
  });

  assert.deepEqual(metrics, {
    width: 160,
    height: 170,
    titleBand: 76,
    sceneY: 76,
    sceneX: 60,
    legendY: 116,
    legendHeight: 54,
    columns: 1,
    rows: 1,
    columnWidth: 112,
    titleTextWidth: 112,
    subtitleTextWidth: 112,
    legendTextWidth: 94,
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

test("safeDiagramFilename normalizes Unicode and avoids Windows device names", () => {
  assert.equal(safeDiagramFilename("Cafe\u0301", "svg"), "Café.svg");
  assert.equal(safeDiagramFilename(" CON ", "svg"), "_CON.svg");
  assert.equal(safeDiagramFilename("con.txt", "png"), "_con.txt.png");
  assert.equal(safeDiagramFilename(" ...--- hello ...--- ", "svg"), "hello.svg");
});

test("safeDiagramFilename accepts only supported extensions", () => {
  for (const extension of ["", "jpeg", ".svg", "svg/evil", "png\\evil"]) {
    assert.throws(
      () => safeDiagramFilename("Diagram", extension),
      /extension[\s\S]*(?:svg|png)/i,
    );
  }
});

test("safeDiagramFilename caps ASCII and CJK components to filesystem limits", () => {
  const encoder = new TextEncoder();
  for (const filename of [
    safeDiagramFilename("a".repeat(304), "svg"),
    safeDiagramFilename("图".repeat(304), "png"),
  ]) {
    assert.ok(filename.endsWith(filename.includes(".svg") ? ".svg" : ".png"));
    assert.ok(encoder.encode(filename).length <= 255);
    assert.ok(filename.length <= 255);
    assert.ok(filename.split(".")[0].length > 0);
  }
});

test("safeDiagramFilename truncates only at grapheme boundaries", () => {
  const family = "👨‍👩‍👧‍👦";
  const filename = safeDiagramFilename(family.repeat(100), "svg");
  const stem = filename.slice(0, -4);

  assert.ok(new TextEncoder().encode(filename).length <= 255);
  assert.ok(filename.length <= 255);
  assert.ok(stem.length > 0);
  assert.equal(stem, family.repeat(stem.length / family.length));
  assert.doesNotMatch(stem, /\uFFFD/);
});

test("renderDiagramSvg emits a complete standalone SVG document with SVG legend", () => {
  const svg = renderDiagramSvg(exportDiagram);

  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?><svg'));
  assert.match(svg, /<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<svg[^>]+width="420"[^>]+height="424"[^>]+viewBox="0 0 420 424"[^>]+role="img"/);
  assert.match(svg, new RegExp(`aria-labelledby="${EXPORT_ID_PREFIX}-title ${EXPORT_ID_PREFIX}-description"`));
  assert.match(svg, new RegExp(`<title id="${EXPORT_ID_PREFIX}-title">Approval &amp; delivery<\\/title>`));
  assert.match(svg, new RegExp(`<desc id="${EXPORT_ID_PREFIX}-description">Export &lt;ready&gt;<\\/desc>`));
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
  assert.doesNotMatch(svg, /\sstyle="/i);
  assert.match(svg, /<svg[^>]+role="img"/);
  assert.match(svg, /id="svg-[^"]+-arrow"/);
  assert.match(svg, /id="svg-[^"]+-clip-0"/);
});

test("renderDiagramSvg escapes XML-sensitive diagram text", () => {
  const svg = renderDiagramSvg(exportDiagram);

  assert.match(svg, />Start &amp; review<\/text>/);
  assert.match(svg, />Approved &lt;now&gt;\?<\/text>/);
  assert.match(svg, />review &gt; approve<\/text>/);
  assert.doesNotMatch(svg, />[^<]*Start & review/);
});

test("DiagramDocument remains a renderable public component", () => {
  const prepared = prepareDiagram(exportDiagram);
  const svg = renderToStaticMarkup(React.createElement(DiagramDocument, { diagram: prepared }));

  assert.match(svg, /^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, /<g transform="translate\(0 76\)">/);
});

test("renderDiagramSvg creates stable collision-free SVG fragment ids and references", () => {
  const specialIds = {
    ...exportDiagram,
    nodes: [
      { ...exportDiagram.nodes[0], id: "a b)#x" },
      { ...exportDiagram.nodes[1], id: "a-b--x" },
    ],
    edges: [{ from: "a b)#x", to: "a-b--x", label: "safe refs" }],
  };
  const first = renderDiagramSvg(specialIds);
  const second = renderDiagramSvg(specialIds);
  const ids = [...first.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const clipIds = ids.filter((id) => id.includes("-clip-"));
  const targets = [...first.matchAll(/url\(#([^\)]+)\)/g)].map((match) => match[1]);

  assert.equal(first, second);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(clipIds.length, 2);
  assert.equal(new Set(clipIds).size, 2);
  assert.ok(ids.every((id) => /^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(id)));
  assert.doesNotMatch(first, /id="[^"]*a b\)#x/);
  for (const target of targets) {
    assert.equal(ids.filter((id) => id === target).length, 1, target);
  }
});

test("DiagramDocument generates unique accessible fragment ids in one React tree", () => {
  const prepared = prepareDiagram(exportDiagram);
  const html = renderToStaticMarkup(React.createElement("div", null, [
    React.createElement(DiagramDocument, { key: "first", diagram: prepared }),
    React.createElement(DiagramDocument, { key: "second", diagram: prepared }),
  ]));
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const references = [...html.matchAll(/aria-labelledby="([^"]+)"/g)]
    .flatMap((match) => match[1].split(/\s+/));

  assert.equal(new Set(ids).size, ids.length);
  assert.equal(references.length, 4);
  for (const reference of references) {
    assert.equal(ids.filter((id) => id === reference).length, 1, reference);
  }
});

test("renderDiagramSvg rejects every XML 1.0 forbidden character class with a field path", () => {
  for (const [value, code] of [
    ["bad\u0000title", "U+0000"],
    ["bad\u000Btitle", "U+000B"],
    ["bad\u000Etitle", "U+000E"],
    ["bad\uD800title", "U+D800"],
    ["bad\uDC00title", "U+DC00"],
    ["bad\uFFFEtitle", "U+FFFE"],
    ["bad\uFFFFtitle", "U+FFFF"],
  ]) {
    assert.throws(
      () => renderDiagramSvg({ ...exportDiagram, title: value }),
      new RegExp(`XML 1\\.0[\\s\\S]*${code.replace("+", "\\+")}[\\s\\S]*title`),
    );
  }
});

test("renderDiagramSvg reports XML-invalid strings throughout the prepared diagram", () => {
  const cases = [
    ["subtitle", { subtitle: "bad\u0001subtitle" }, /subtitle/],
    ["node label", { nodes: [{ ...exportDiagram.nodes[0], label: "bad\u0002label" }, exportDiagram.nodes[1]] }, /nodes\[0\]\.label/],
    ["node sublabel", { nodes: [{ ...exportDiagram.nodes[0], sublabel: "bad\u0003sublabel" }, exportDiagram.nodes[1]] }, /nodes\[0\]\.sublabel/],
    ["node style", { nodes: [{ ...exportDiagram.nodes[0], style: { fill: "bad\u0004paint" } }, exportDiagram.nodes[1]] }, /nodes\[0\]\.style\.fill/],
    ["edge", { edges: [{ ...exportDiagram.edges[0], label: "bad\u0005edge" }] }, /edges\[0\]\.label/],
    ["tier", { tiers: [{ id: "tier", label: "bad\u0006tier", x: 0, y: 0, width: 420, height: 100 }] }, /tiers\[0\]\.label/],
    ["legend", { legend: [{ type: "terminal", label: "bad\u0007legend" }] }, /legend\[0\]\.label/],
  ];

  for (const [name, change, path] of cases) {
    assert.throws(
      () => renderDiagramSvg({ ...exportDiagram, ...change }),
      (error) => error instanceof TypeError && path.test(error.message),
      name,
    );
  }
});

test("renderDiagramSvg preserves XML-valid whitespace and non-BMP text", () => {
  const title = "Valid\ttab\nline\rreturn 😀";
  const svg = renderDiagramSvg({ ...exportDiagram, title });

  assert.match(svg, /Valid\ttab\nline\rreturn 😀/);
  assert.doesNotMatch(svg, /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/u);
});

test("renderDiagramSvg rejects non-standalone paint values with actionable paths", () => {
  const cases = [
    ["fill", " URL ( https://example.test/fill.svg#paint ) "],
    ["stroke", "vAr( --stroke )"],
    ["accent", "url(#external-accent)"],
    ["text", "VAR(--text)"],
    ["fill", "\\75rl(https://example.test/escaped.svg#paint)"],
    ["stroke", "v\\61r(--escaped-stroke)"],
    ["accent", "u/**/rl(https://example.test/comment.svg#paint)"],
    ["text", "calc(1 + 2)"],
    ["fill", "env(system-color)"],
    ["stroke", "color(display-p3 1 0 0)"],
  ];
  const serialized = [];

  for (const [field, value] of cases) {
    assert.throws(
      () => serialized.push(renderDiagramSvg({
        ...exportDiagram,
        nodes: [{ ...exportDiagram.nodes[0], style: { [field]: value } }, exportDiagram.nodes[1]],
      })),
      new RegExp(`paint[\\s\\S]*nodes\\[0\\]\\.style\\.${field}`, "i"),
    );
  }
  assert.equal(serialized.length, 0);
  assert.throws(
    () => renderDiagramSvg({
      ...exportDiagram,
      nodes: [{ ...exportDiagram.nodes[0], style: { fill: 42 } }, exportDiagram.nodes[1]],
    }),
    /paint[\s\S]*nodes\[0\]\.style\.fill/i,
  );
  assert.throws(
    () => renderDiagramSvg({
      ...exportDiagram,
      tiers: [{ id: "tier", label: "Tier", x: 0, y: 0, width: 420, height: 100, color: " Url (#outside)" }],
    }),
    /paint[\s\S]*tiers\[0\]\.color/i,
  );
});

test("renderDiagramSvg accepts self-contained paint colors", () => {
  const svg = renderDiagramSvg({
    ...exportDiagram,
    nodes: [{
      ...exportDiagram.nodes[0],
      type: "process",
      style: {
        fill: " #AbC ",
        stroke: " RgB( 10 20 30 / 50% ) ",
        accent: " HsL( 120deg 50% 40% / .75 ) ",
        text: " CurrentColor ",
      },
    }, exportDiagram.nodes[1]],
    tiers: [{ id: "tier", label: "Tier", x: 0, y: 0, width: 420, height: 100, color: " AlIcEbLuE " }],
  });

  assert.match(svg, /fill=" #AbC "/);
  assert.match(svg, /stroke=" RgB\( 10 20 30 \/ 50% \) "/);
  assert.match(svg, /fill=" HsL\( 120deg 50% 40% \/ \.75 \) "/);
  assert.match(svg, /fill=" CurrentColor "/);
  assert.match(svg, /fill=" AlIcEbLuE "/);
  assert.doesNotMatch(svg, /\\75rl|v\\61r|u\/\*\*\/rl/);
});

test("renderDiagramSvg keeps long document text inside a widened narrow export", () => {
  const svg = renderDiagramSvg({
    kind: "flowchart",
    title: "A very long heading that must remain inside the exported document",
    subtitle: "A very long subtitle that must also remain inside the exported document",
    width: 40,
    height: 40,
    nodes: [],
    edges: [],
    legend: [{ type: "process", label: "A very long legend label that cannot overflow" }],
  });
  const heading = svg.match(/<text x="80" y="30"[^>]*textLength="([^"]+)"[^>]*lengthAdjust="spacingAndGlyphs"/);
  const subtitle = svg.match(/<text x="80" y="52"[^>]*textLength="([^"]+)"[^>]*lengthAdjust="spacingAndGlyphs"/);
  const circle = svg.match(/<circle cx="([^"]+)" cy="17" r="5"/);
  const legend = svg.match(/<text x="([^"]+)" y="17"[^>]*textLength="([^"]+)"[^>]*lengthAdjust="spacingAndGlyphs"/);

  assert.match(svg, /<svg[^>]+width="160"[^>]+height="170"[^>]+viewBox="0 0 160 170"/);
  assert.match(svg, /<g transform="translate\(60 76\)">/);
  assert.ok(heading && Number(heading[1]) <= 112);
  assert.ok(subtitle && Number(subtitle[1]) <= 112);
  assert.ok(circle && Number(circle[1]) >= 5 && Number(circle[1]) <= 155);
  assert.ok(legend);
  assert.ok(Number(legend[1]) >= 0 && Number(legend[1]) <= 160);
  assert.ok(Number(legend[2]) <= 94);
  assert.ok(Number(legend[1]) + Number(legend[2]) <= 136);
});
