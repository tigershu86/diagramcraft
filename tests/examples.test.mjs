import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ARCH_ECOMMERCE,
  ARCH_FLOWCHART_STYLE,
  LOGIN_FLOW,
} from "../examples/diagrams.js";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { validateLayout } from "../src/diagram/geometry.js";
import { prepareDiagram } from "../src/diagram/layout/index.js";
import { validateDiagram } from "../src/diagram/schema.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const examples = [
  ["examples/arch-ecommerce.jsx", ARCH_ECOMMERCE, 22],
  ["examples/arch-flowchart-style.jsx", ARCH_FLOWCHART_STYLE, 22],
  ["examples/flowchart-login.jsx", LOGIN_FLOW, 10],
];

test("all example diagrams satisfy the shared schema and render", () => {
  for (const [, diagram, expectedNodes] of examples) {
    assert.deepEqual(validateDiagram(diagram), []);
    assert.equal(diagram.nodes.length, expectedNodes);
    const prepared = prepareDiagram(diagram);
    assert.ok(prepared.nodes.every((node) => node.width > 0 && node.height > 0));
    assert.deepEqual(validateLayout(prepared, { padding: 12, gap: 0 }), []);
    const html = renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram }));
    assert.match(html, new RegExp(`<title[^>]*>${diagram.title}</title>`));
  }
});

test("example entry points are thin wrappers around the shared renderer", () => {
  for (const [relativePath] of examples) {
    const source = fs.readFileSync(path.join(root, relativePath), "utf8");
    assert.match(source, /DiagramRenderer/);
    assert.match(source, /from "\.\/diagrams\.js"/);
    assert.ok(source.split(/\r?\n/).length <= 12, `${relativePath} duplicated renderer code`);
  }
});
