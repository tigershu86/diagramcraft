import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { prepareDiagram } from "../src/diagram/layout/index.js";

const diagram = {
  kind: "flowchart",
  title: "Approval flow",
  subtitle: "Accessible renderer",
  width: 420,
  height: 260,
  nodes: [
    { id: "start", label: "Start", type: "terminal", x: 140, y: 20 },
    { id: "approve", label: "Approved?", type: "decision", x: 135, y: 130 },
  ],
  edges: [{ from: "start", to: "approve", label: "review" }],
};

test("DiagramRenderer emits an accessible SVG with data-driven nodes and edges", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram }));

  assert.match(html, /<svg[^>]+role="group"/);
  assert.doesNotMatch(html, /<svg[^>]+height="auto"/);
  assert.match(html, /class="diagram-frame" style="[^"]*max-width:452px;[^"]*margin:0 auto/);
  assert.match(html, /<svg[^>]+style="[^"]*min-width:420px"/);
  assert.match(html, /<title[^>]*>Approval flow<\/title>/);
  assert.match(html, /<desc[^>]*>Accessible renderer<\/desc>/);
  assert.match(html, /aria-label="Start"/);
  assert.match(html, /aria-label="Approved\?"/);
  assert.match(html, /<g role="button" tabindex="0" aria-label="Start" aria-pressed="false"/);
  assert.match(html, /cursor:pointer/);
  assert.match(html, /transition:transform 180ms ease,\s*filter 180ms ease/);
  assert.match(html, /M 210 64 C/);
  assert.match(html, />review<\/text>/);
});

test("DiagramRenderer preserves optional preview output modes", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram,
    showHeader: false,
    showLegend: false,
    showHint: false,
  }));

  assert.doesNotMatch(html, /<header/);
  assert.doesNotMatch(html, /class="diagram-legend"/);
  assert.doesNotMatch(html, /点击或按 Enter/);
  assert.match(html, /<section class="diagram-renderer"/);
  assert.match(html, /<svg[^>]+role="group"/);
  assert.match(html, /<g role="button" tabindex="0"/);
});

test("DiagramRenderer ignores an initial selection missing from the current diagram", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    initialSelectedId: "gone",
    diagram,
  }));

  assert.doesNotMatch(html, /opacity="0\.16"/);
});

test("DiagramRenderer rejects invalid graph data before rendering", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, edges: [{ from: "start", to: "ghost" }] },
    })),
    /missing-edge-target/,
  );
});

test("DiagramRenderer rejects non-finite derived geometry before producing SVG", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: {
        kind: "flowchart",
        title: "Overflowing render",
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
      },
    })),
    /layout-canvas-width[\s\S]*layout-node-right[\s\S]*layout-feedback-gutter/,
  );
});

test("DiagramRenderer rejects non-finite controls on an ordinary explicit-anchor edge", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: {
        kind: "flowchart",
        title: "Overflowing explicit render",
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
      },
    })),
    /layout-edge-control[\s\S]*layout-edge-path-bounds[\s\S]*layout-edge-label-bounds/,
  );
});

test("DiagramRenderer prepares and renders a coordinate-free flow", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Unprepared flow",
      nodes: [
        { id: "start", label: "Start", type: "terminal" },
        { id: "finish", label: "Finish", type: "terminal" },
      ],
      edges: [{ from: "start", to: "finish" }],
    },
  }));

  assert.match(html, /<svg[^>]+viewBox="0 0 \d+(?:\.\d+)? \d+(?:\.\d+)?"/);
  assert.match(html, /aria-label="Start"/);
  assert.match(html, /aria-label="Finish"/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined/);
});

test("DiagramRenderer renders cyclic feedback through the outer gutter", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Cyclic flow",
      nodes: [
        { id: "first", label: "First", type: "process" },
        { id: "second", label: "Second", type: "process" },
      ],
      edges: [{ from: "first", to: "second" }, { from: "second", to: "first", label: "again" }],
    },
  }));

  assert.match(html, /M 410 172 C 470 172 470 60 410 60/);
});

test("DiagramRenderer renders a visible feedback self-loop without lifting its label above the canvas", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Tiny self loop",
      width: 120,
      height: 80,
      nodes: [{ id: "self", label: "Self", type: "process", x: 20, y: 0, width: 20, height: 20 }],
      edges: [{ from: "self", to: "self", label: "again" }],
    },
  }));

  assert.match(html, /M 40 10 C \d+(?:\.\d+)? 10 \d+(?:\.\d+)? 58 40 10/);
  const pillY = Number(html.match(/<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="18" rx="5"/)?.[1]);
  assert.ok(pillY >= 12);
});

test("DiagramRenderer keeps a long feedback label pill padded inside the scene", () => {
  const label = "Return to the beginning after the reviewer requests another complete revision cycle and include every required follow-up note before requesting one more review";
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Padded feedback",
      nodes: [
        { id: "first", label: "First", type: "process" },
        { id: "second", label: "Second", type: "process" },
      ],
      edges: [{ from: "first", to: "second" }, { from: "second", to: "first", label }],
    },
  }));
  const viewBox = html.match(/viewBox="0 0 ([^"]+) ([^"]+)"/);
  const pill = html.match(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="18" rx="5"/);
  assert.ok(viewBox && pill);
  const canvasWidth = Number(viewBox[1]);
  const canvasHeight = Number(viewBox[2]);
  const [x, y, width] = pill.slice(1).map(Number);

  assert.ok(x >= 12);
  assert.ok(x + width <= canvasWidth - 12);
  assert.ok(y >= 12);
  assert.ok(y + 18 <= canvasHeight - 12);
});

test("DiagramRenderer constrains CJK label text to its grapheme-aware pill", () => {
  const label = "回".repeat(20);
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "CJK feedback",
      nodes: [
        { id: "first", label: "First", type: "process" },
        { id: "second", label: "Second", type: "process" },
      ],
      edges: [{ from: "first", to: "second" }, { from: "second", to: "first", label }],
    },
  }));
  const canvasWidth = Number(html.match(/viewBox="0 0 ([^"]+) [^"]+"/)?.[1]);
  const pill = html.match(/<rect x="([^"]+)" y="[^"]+" width="([^"]+)" height="18" rx="5"/);
  assert.ok(pill);
  const x = Number(pill[1]);
  const width = Number(pill[2]);

  assert.ok(width >= 213 && width <= 215);
  assert.ok(x >= 12 && x + width <= canvasWidth - 12);
  assert.match(html, /textLength="200"/);
  assert.match(html, /lengthAdjust="spacingAndGlyphs"/);
});

test("DiagramRenderer consumes a prepared cyclic diagram", () => {
  const prepared = prepareDiagram({
    kind: "flowchart",
    title: "Prepared cycle",
    nodes: [
      { id: "first", label: "First", type: "process" },
      { id: "second", label: "Second", type: "process" },
    ],
    edges: [{ from: "first", to: "second" }, { from: "second", to: "first" }],
  });
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram: prepared }));

  assert.match(html, /M 410 172 C 470 172 470 60 410 60/);
  assert.doesNotMatch(html, /NaN|Infinity|undefined/);
});

test("DiagramRenderer rejects caller-supplied internal edge metadata", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: {
        ...diagram,
        edges: [{ from: "start", to: "approve", route: "feedback", gutterX: 9999 }],
      },
    })),
    /unknown-edge-field[\s\S]*route[\s\S]*unknown-edge-field[\s\S]*gutterX/,
  );
});

test("DiagramRenderer rejects coordinate node defaults before they can supply positions", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: {
        kind: "flowchart",
        title: "Invalid defaults",
        width: 320,
        height: 180,
        nodeDefaults: { x: 80, y: 40 },
        nodes: [{ id: "start", label: "Start", type: "terminal" }],
        edges: [],
      },
    })),
    /invalid-node-default-field[\s\S]*nodeDefaults\.x/,
  );
});

test("DiagramRenderer resolves explicit undefined node dimensions before rendering", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Prepared defaults",
      width: 320,
      height: 180,
      nodes: [{
        id: "start",
        label: "Start",
        type: "terminal",
        x: 90,
        y: 60,
        width: undefined,
        height: undefined,
        shape: undefined,
      }],
      edges: [],
    },
  }));

  assert.match(html, /<rect x="90" y="60" width="140" height="44"/);
  assert.doesNotMatch(html, /NaN|undefined/);
});

test("DiagramRenderer rejects non-string node sublabels before React renders them", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, nodes: [{ ...diagram.nodes[0], sublabel: { detail: "unsafe" } }, diagram.nodes[1]] },
    })),
    /invalid-node-sublabel/,
  );
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, nodeDefaults: { sublabel: { detail: "unsafe" } } },
    })),
    /invalid-node-default-sublabel/,
  );
});

test("DiagramRenderer reports actionable preparation errors for invalid manual tiers", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, tiers: [{ id: "missing-y", label: "Missing y", height: 40 }] },
    })),
    /layout-tier-y/,
  );
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, tiers: [{ id: "missing-height", label: "Missing height", y: 0 }] },
    })),
    /layout-tier-height/,
  );
});

test("DiagramRenderer lifts labels above adjacent nodes on short horizontal edges", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Adjacent nodes",
      width: 440,
      height: 220,
      nodes: [
        { id: "left", label: "Left", type: "process", x: 20, y: 100 },
        { id: "right", label: "Right", type: "process", x: 220, y: 100 },
      ],
      edges: [{ from: "left", to: "right", label: "Event" }],
    },
  }));

  assert.match(html, /<rect x="187\.5" y="81" width="45" height="18"[^>]*>/);
});

test("DiagramRenderer colors selected edge arrowheads with the source node accent", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    initialSelectedId: "service",
    diagram: {
      kind: "architecture",
      title: "Selected edge",
      width: 440,
      height: 220,
      nodes: [
        { id: "service", label: "Service", type: "service", x: 20, y: 80 },
        { id: "database", label: "Database", type: "database", x: 250, y: 74 },
      ],
      edges: [{ from: "service", to: "database" }],
    },
  }));

  assert.match(html, /<marker id="[^"]+-service-database"[^>]*><path[^>]+fill="#16A34A"/);
  assert.match(html, /<path d="M [^"]+" fill="none" stroke="#16A34A"[^>]+marker-end="url\(#[^"]+-service-database\)"/);
});
