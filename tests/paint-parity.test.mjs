import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Ajv2020 from "ajv/dist/2020.js";

import { buildDiagramSchema } from "../scripts/schema.mjs";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { renderDiagramSvg } from "../src/diagram/export.js";
import { prepareDiagram } from "../src/diagram/layout/index.js";
import { validateDiagram } from "../src/diagram/schema.js";

const validateJson = new Ajv2020({ strict: true, allErrors: true }).compile(buildDiagramSchema());

const baseDiagram = {
  kind: "flowchart",
  title: "Paint parity",
  width: 420,
  height: 220,
  tiers: [{ id: "main", label: "Main", x: 0, y: 0, width: 420, height: 100 }],
  nodes: [
    { id: "start", label: "Start", type: "process", x: 30, y: 30 },
    { id: "finish", label: "Finish", type: "terminal", x: 240, y: 130 },
  ],
  edges: [{ from: "start", to: "finish" }],
};

const targets = [
  ...["fill", "stroke", "accent", "text"].map((field) => ({
    name: `node.style.${field}`,
    path: `nodes[0].style.${field}`,
    code: "invalid-node-style-paint",
    diagram(value) {
      return {
        ...baseDiagram,
        nodes: [{ ...baseDiagram.nodes[0], style: { [field]: value } }, baseDiagram.nodes[1]],
      };
    },
  })),
  {
    name: "tier.color",
    path: "tiers[0].color",
    code: "invalid-tier-color",
    diagram(value) {
      return {
        ...baseDiagram,
        tiers: [{ ...baseDiagram.tiers[0], color: value }],
      };
    },
  },
];

const validPaints = [
  " #AbC ",
  "#aBcD",
  "#123456",
  "#12345678",
  " AlIcEbLuE ",
  " CurrentColor ",
  "transparent",
  "none",
  "rgb(1, 2, 3)",
  "rgba(10%, 20%, 30%, 50%)",
  "rgb(10 20% 30 / 40%)",
  "rgb(1e2 2e-3 3)",
  "hsl(120deg, 50%, 40%)",
  "hsla(.5turn 50% 40% / .75)",
  "hwb(120 10% 20% / 30%)",
  "lab(50% 0 .2 / 1)",
  "lch(50% 20 120deg / .5)",
  "oklab(.5 .1 .2 / 50%)",
  "oklch(.5 .2 .25turn / 50%)",
];

const invalidPaints = [
  42,
  null,
  {},
  [],
  "url(#paint)",
  "vAr(--paint)",
  "calc(1 + 2)",
  "env(system-color)",
  "color(display-p3 1 0 0)",
  "\\75rl(#paint)",
  "v\\61r(--paint)",
  "u/**/rl(#paint)",
  "rgb(1. 2 3)",
  "rgb(1.e2 2 3)",
  "rgb(10%,20,30%)",
  "rgba(1 2 3 4)",
  "hsl(120deg 50 40%)",
  "lab(1e999 0 0)",
  `rgb(${"9".repeat(309)} 0 0)`,
  "oklch(NaN .2 .25turn)",
  "rgb(Infinity 0 0)",
];

test("safe paints have JSON Schema, runtime, preview, and standalone export parity", () => {
  for (const target of targets) {
    for (const paint of validPaints) {
      const diagram = target.diagram(paint);
      assert.equal(validateJson(diagram), true, `${target.name} ${paint}: ${JSON.stringify(validateJson.errors)}`);
      assert.deepEqual(validateDiagram(diagram), [], `${target.name} ${paint}`);
      assert.doesNotThrow(() => prepareDiagram(diagram), `${target.name} ${paint}`);
      assert.doesNotThrow(
        () => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram })),
        `${target.name} ${paint}`,
      );
      assert.doesNotThrow(() => renderDiagramSvg(diagram), `${target.name} ${paint}`);
    }
  }
});

test("unsafe paints fail JSON Schema, runtime, preview, and standalone export at the same path", () => {
  for (const target of targets) {
    for (const paint of invalidPaints) {
      const diagram = target.diagram(paint);
      assert.equal(validateJson(diagram), false, `${target.name} ${String(paint)}`);
      const matchingIssue = validateDiagram(diagram).find(({ code, path }) => (
        code === target.code && path === target.path
      ));
      assert.ok(matchingIssue, `${target.name} ${String(paint)}: ${JSON.stringify(validateDiagram(diagram))}`);
      const errorPattern = new RegExp(`${target.code}[\\s\\S]*${target.path.replace(/[.[\]]/g, "\\$&")}`);
      assert.throws(() => prepareDiagram(diagram), errorPattern, `${target.name} ${String(paint)}`);
      assert.throws(
        () => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram })),
        errorPattern,
        `${target.name} ${String(paint)}`,
      );
      assert.throws(() => renderDiagramSvg(diagram), errorPattern, `${target.name} ${String(paint)}`);
    }
  }
});

test("node style is closed to the four renderer paint fields", () => {
  const diagram = {
    ...baseDiagram,
    nodes: [{ ...baseDiagram.nodes[0], style: { shadow: "red" } }, baseDiagram.nodes[1]],
  };

  assert.equal(validateJson(diagram), false);
  assert.ok(validateJson.errors.some(({ keyword, instancePath }) => (
    keyword === "additionalProperties" && instancePath === "/nodes/0/style"
  )));
  assert.deepEqual(validateDiagram(diagram).filter(({ code }) => code === "unknown-node-style-field"), [{
    code: "unknown-node-style-field",
    path: "nodes[0].style.shadow",
    message: "node style field shadow is not supported",
  }]);
  assert.throws(() => prepareDiagram(diagram), /unknown-node-style-field[\s\S]*nodes\[0\]\.style\.shadow/);
  assert.throws(
    () => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram })),
    /unknown-node-style-field[\s\S]*nodes\[0\]\.style\.shadow/,
  );
  assert.throws(() => renderDiagramSvg(diagram), /unknown-node-style-field[\s\S]*nodes\[0\]\.style\.shadow/);
});
