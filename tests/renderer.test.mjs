import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";

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
  assert.match(html, /M 210 64 C/);
  assert.match(html, />review<\/text>/);
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

test("DiagramRenderer rejects manual tiers missing required geometry before rendering", () => {
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, tiers: [{ label: "Missing y", height: 40 }] },
    })),
    /missing-tier-y/,
  );
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, {
      diagram: { ...diagram, tiers: [{ label: "Missing height", y: 0 }] },
    })),
    /missing-tier-height/,
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
