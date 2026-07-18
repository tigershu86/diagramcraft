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

  assert.match(html, /M 410 172 C 664 172 664 60 410 60/);
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

  assert.match(html, /M 410 172 C 664 172 664 60 410 60/);
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
