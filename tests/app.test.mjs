import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import * as AppModule from "../src/App.js";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { layoutDiagram } from "../src/diagram/layout/index.js";

const {
  default: App,
  EXAMPLE_OPTIONS,
  formatActionError,
  isCurrentActionRequest,
  setExampleOverride,
  tabIdForKey,
} = AppModule;
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("preview app exposes every example through an accessible tab list", () => {
  const html = renderToStaticMarkup(React.createElement(App));

  assert.equal(EXAMPLE_OPTIONS.length, 3);
  assert.match(html, /role="tablist"/);
  assert.equal((html.match(/role="tab"/g) || []).length, 3);
  assert.equal((html.match(/aria-selected="true"/g) || []).length, 1);
  assert.match(html, /E-Commerce Platform Architecture/);
  assert.match(html, /Shared schema/);
  assert.match(html, /3 examples/);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /aria-labelledby="tab-architecture"/);
});

test("preview toolbar exposes independent diagram actions and a persistent live status", () => {
  const html = renderToStaticMarkup(React.createElement(App));

  assert.match(html, /class="toolbar-controls"/);
  assert.match(html, /role="tablist"[^>]*aria-label="Diagram examples"/);
  assert.match(html, /class="diagram-actions"[^>]*role="group"[^>]*aria-label="Diagram actions"/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Auto layout<\/button>/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Export SVG<\/button>/);
  assert.match(html, /<button[^>]*type="button"[^>]*>Export PNG<\/button>/);
  assert.match(html, /<p[^>]*class="action-status"[^>]*role="status"[^>]*aria-live="polite"><\/p>/);
});

test("tabIdForKey wraps arrow navigation and supports Home and End", () => {
  assert.equal(tabIdForKey("architecture", "ArrowLeft"), "flowchart");
  assert.equal(tabIdForKey("flowchart", "ArrowRight"), "architecture");
  assert.equal(tabIdForKey("hybrid", "Home"), "architecture");
  assert.equal(tabIdForKey("hybrid", "End"), "flowchart");
  assert.equal(tabIdForKey("hybrid", "Enter"), null);
});

test("setExampleOverride adds and replaces diagrams without mutating its input", () => {
  const first = { title: "First" };
  const replacement = { title: "Replacement" };
  const input = { flowchart: first };

  const added = setExampleOverride(input, "architecture", first);
  const replaced = setExampleOverride(added, "architecture", replacement);

  assert.notEqual(added, input);
  assert.deepEqual(input, { flowchart: first });
  assert.equal(added.architecture, first);
  assert.equal(replaced.architecture, replacement);
  assert.equal(replaced.flowchart, first);
});

test("setExampleOverride removes only the selected example override", () => {
  const architecture = { title: "Architecture" };
  const flowchart = { title: "Flowchart" };
  const input = { architecture, flowchart };

  const result = setExampleOverride(input, "architecture", null);

  assert.notEqual(result, input);
  assert.deepEqual(input, { architecture, flowchart });
  assert.deepEqual(result, { flowchart });
});

test("force layout can be stored as an isolated override and rendered without mutating the example", () => {
  const original = EXAMPLE_OPTIONS[0].diagram;
  const originalCoordinates = original.nodes.map(({ x, y }) => ({ x, y }));
  const forced = layoutDiagram(original, { mode: "force" });
  const withArchitecture = setExampleOverride({}, "architecture", forced);
  const withFlowchart = setExampleOverride(withArchitecture, "flowchart", EXAMPLE_OPTIONS[2].diagram);
  const restoredArchitecture = setExampleOverride(withFlowchart, "architecture", null);
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: withArchitecture.architecture,
  }));

  assert.match(html, /class="diagram-renderer"/);
  assert.deepEqual(original.nodes.map(({ x, y }) => ({ x, y })), originalCoordinates);
  assert.equal(withArchitecture.architecture, forced);
  assert.equal(withFlowchart.architecture, forced);
  assert.equal(withFlowchart.flowchart, EXAMPLE_OPTIONS[2].diagram);
  assert.equal("architecture" in restoredArchitecture, false);
  assert.equal(restoredArchitecture.flowchart, EXAMPLE_OPTIONS[2].diagram);
});

test("formatActionError keeps action failures readable for Error and non-Error values", () => {
  assert.equal(formatActionError(new Error("boom")), "boom");
  assert.equal(formatActionError("network unavailable"), "network unavailable");
  assert.equal(formatActionError(0), "0");
  assert.equal(formatActionError(false), "false");
  assert.equal(formatActionError(""), "Unknown error");
  assert.equal(formatActionError(null), "Unknown error");
});

test("isCurrentActionRequest accepts only the latest mounted request token", () => {
  assert.equal(isCurrentActionRequest(4, 4, true), true);
  assert.equal(isCurrentActionRequest(5, 4, true), false);
  assert.equal(isCurrentActionRequest(4, 4, false), false);
});

test("action controls have high-contrast, responsive, keyboard-visible styling", () => {
  assert.match(styles, /\.toolbar-controls\s*\{[^}]*display:\s*(?:grid|flex)/s);
  assert.match(styles, /\.diagram-actions\s*\{[^}]*display:\s*flex/s);
  assert.match(styles, /\.diagram-actions button:first-child\s*\{[^}]*color:\s*#ffffff[^}]*background:\s*#4f46e5/s);
  assert.match(styles, /\.diagram-actions button:not\(:first-child\)\s*\{[^}]*border[^:]*:\s*1px solid #cbd5e1[^}]*background:\s*#ffffff/s);
  assert.match(styles, /\.diagram-actions button:first-child:hover/);
  assert.match(styles, /\.diagram-actions button:not\(:first-child\):hover/);
  assert.match(styles, /\.diagram-actions button:focus-visible\s*\{[^}]*3px solid rgba\(99,\s*102,\s*241,\s*0\.28\)/s);
  assert.match(styles, /\.diagram-actions button:disabled/);
  assert.match(styles, /\.action-status\s*\{/);
  assert.match(styles, /@media \(max-width:\s*1100px\)[\s\S]*?\.workspace-toolbar\s*\{[^}]*flex-direction:\s*column/);
  assert.match(styles, /@media \(max-width:\s*1100px\)[\s\S]*?\.toolbar-controls\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(styles, /@media \(max-width:\s*1100px\)[\s\S]*?\.example-tabs\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(styles, /@media \(max-width:\s*1100px\)[\s\S]*?\.diagram-actions\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(styles, /@media \(max-width:\s*480px\)[\s\S]*?\.diagram-actions\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(styles, /@media \(max-width:\s*480px\)[\s\S]*?\.diagram-actions button\s*\{[^}]*flex:\s*0 0 auto[^}]*min-height:\s*44px/);
});

test("App can be imported in Node without browser globals", async () => {
  assert.equal(typeof window, "undefined");
  assert.equal(typeof document, "undefined");

  const imported = await import(`../src/App.js?node-import=${Date.now()}`);
  assert.equal(typeof imported.default, "function");
});
