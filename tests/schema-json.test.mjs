import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import {
  ARCH_ECOMMERCE,
  ARCH_FLOWCHART_STYLE,
  LOGIN_FLOW,
} from "../examples/diagrams.js";
import {
  NODE_DEFAULT_FIELDS,
  NODE_TYPES,
} from "../src/diagram/contract.js";
import { validateDiagram } from "../src/diagram/schema.js";
import { buildDiagramSchema } from "../scripts/schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const schemaPath = path.join(root, "schema/diagram.schema.json");

function validator() {
  return new Ajv2020({ strict: true, allErrors: true }).compile(buildDiagramSchema());
}

function coordinateFreeFlowchart() {
  return {
    kind: "flowchart",
    title: "Coordinate-free flow",
    nodes: [
      { id: "start", label: "Start", type: "terminal" },
      { id: "work", label: "Work", type: "process" },
    ],
    edges: [{ from: "start", to: "work" }],
  };
}

test("checked-in artifact is byte-for-byte generated from the centralized contract", () => {
  assert.equal(fs.existsSync(schemaPath), true);
  assert.equal(fs.readFileSync(schemaPath, "utf8"), `${JSON.stringify(buildDiagramSchema(), null, 2)}\n`);
});

test("JSON Schema validates all checked-in examples", () => {
  const validate = validator();
  for (const diagram of [ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE, LOGIN_FLOW]) {
    assert.equal(validate(diagram), true, JSON.stringify(validate.errors));
  }
});

test("JSON Schema accepts coordinate-free diagrams and architecture tier membership", () => {
  const validate = validator();
  assert.equal(validate(coordinateFreeFlowchart()), true, JSON.stringify(validate.errors));
  assert.equal(validate({
    kind: "architecture",
    title: "Coordinate-free architecture",
    tiers: [{ id: "edge", label: "Edge" }],
    nodes: [{ id: "gateway", label: "Gateway", type: "gateway", tier: "edge" }],
    edges: [],
  }), true, JSON.stringify(validate.errors));
});

test("JSON Schema requires tier labels to be strings but does not require their content", () => {
  const validate = validator();
  assert.equal(validate({
    ...coordinateFreeFlowchart(),
    tiers: [{ id: "edge", label: "" }],
  }), true, JSON.stringify(validate.errors));
});

test("JSON Schema requires node x and y together", () => {
  const validate = validator();
  assert.equal(validate({
    ...coordinateFreeFlowchart(),
    nodes: [{ id: "start", label: "Start", type: "terminal", x: 40 }],
  }), false);
  assert.ok(validate.errors.some((error) => error.keyword === "dependentRequired"));
});

test("nodeDefaults derives exactly from the public contract fields", () => {
  const schema = buildDiagramSchema();
  const defaults = schema.$defs.nodeDefaults;
  assert.deepEqual(Object.keys(defaults.properties), NODE_DEFAULT_FIELDS);
  const validate = validator();

  for (const [field, value] of Object.entries({
    width: 160,
    height: 72,
    shape: "terminal",
    sublabel: "Shared detail",
  })) {
    assert.equal(validate({ ...coordinateFreeFlowchart(), nodeDefaults: { [field]: value } }), true,
      `${field}: ${JSON.stringify(validate.errors)}`);
  }
  for (const nodeDefaults of [{ x: 10 }, { y: 10 }, { bogus: true }]) {
    assert.equal(validate({ ...coordinateFreeFlowchart(), nodeDefaults }), false);
    assert.ok(validate.errors.some((error) => error.keyword === "additionalProperties"));
  }
});

test("runtime-supported rendering fields are JSON Schema-valid", () => {
  const diagram = {
    ...coordinateFreeFlowchart(),
    edges: [],
    nodes: [{
      id: "start",
      label: "Start",
      type: "terminal",
      sublabel: "Step one",
      fontSize: 14,
      style: { fill: "#fff", accent: "#111" },
    }],
  };
  assert.deepEqual(validateDiagram(diagram), []);
  const validate = validator();
  assert.equal(validate(diagram), true, JSON.stringify(validate.errors));
});

test("known invalid values fail with their JSON Schema keywords", () => {
  const validate = validator();
  const invalidFixtures = [
    [{ ...coordinateFreeFlowchart(), nodes: [{ id: "", label: "Start", type: "terminal" }] }, "minLength"],
    [{ ...coordinateFreeFlowchart(), nodes: [{ id: "start", label: "Start", type: "unknown" }] }, "enum"],
    [{ ...coordinateFreeFlowchart(), nodeDefaults: { bogus: true } }, "additionalProperties"],
  ];

  for (const [diagram, keyword] of invalidFixtures) {
    assert.equal(validate(diagram), false);
    assert.ok(validate.errors.some((error) => error.keyword === keyword), `${keyword}: ${JSON.stringify(validate.errors)}`);
  }
  assert.ok(NODE_TYPES.length > 0);
});
