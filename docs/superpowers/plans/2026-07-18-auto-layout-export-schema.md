# Automatic Layout, Export, and JSON Schema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic mixed/force diagram layout, complete standalone SVG and 2x PNG export, and a generated Draft 2020-12 JSON Schema to Diagramcraft.

**Architecture:** A shared contract validates raw graph data and generates the public JSON Schema. `prepareDiagram()` resolves node sizes before passing a non-mutating graph to a small deterministic layered layout engine; preview and export then reuse a single `DiagramScene`. Browser-only download helpers wrap a pure SVG document renderer so layout, SVG, and filename behavior stay testable under Node.

**Tech Stack:** Node.js 22 test runner, React 19, React DOM static rendering, Vite 8, SVG, browser Canvas/Blob APIs, Ajv 8 as a development-only Draft 2020-12 validator.

---

## File Map

Create these focused modules:

- `src/diagram/contract.js` — shared kinds, anchors, types, shapes, node presets, and coordinate helpers.
- `src/diagram/layout/graph.js` — feedback-edge detection, rank assignment, and stable barycenter ordering.
- `src/diagram/layout/flowchart.js` — force layout for top-to-bottom flowcharts.
- `src/diagram/layout/architecture.js` — force layout for tier-constrained architecture diagrams.
- `src/diagram/layout/index.js` — `layoutDiagram()` and `prepareDiagram()`, including mixed fixed/missing placement.
- `src/diagram/DiagramScene.js` — SVG-only tier, edge, node, marker, and label drawing.
- `src/diagram/DiagramDocument.js` — SVG-native title, subtitle, scene, and legend composition.
- `src/diagram/export.js` — SVG serialization, filename cleaning, PNG rasterization, and downloads.
- `scripts/schema.mjs` — deterministic Draft 2020-12 schema builder.
- `scripts/generate-schema.mjs` — write/check CLI for the generated artifact.
- `schema/diagram.schema.json` — checked-in generated contract.
- `tests/layout-graph.test.mjs`, `tests/layout.test.mjs`, `tests/schema-json.test.mjs`, `tests/export.test.mjs` — focused new coverage.

Modify these existing files:

- `src/diagram/schema.js` — optional dimensions/coordinates and tier-reference validation.
- `src/diagram/geometry.js` — route prepared feedback edges through an outer gutter.
- `src/diagram/DiagramRenderer.js` — prepare input and wrap `DiagramScene` with preview-only UI.
- `src/App.js`, `src/styles.css` — reversible relayout and export controls.
- `examples/diagrams.js` — add tier IDs to the two architecture datasets.
- `scripts/validate.mjs`, `scripts/package-skills.sh`, `package.json`, `package-lock.json` — schema checks and package injection.
- `README.md`, `arch-diagram/SKILL.md`, `flowchart/SKILL.md` — document the shared contract, automatic layout, and packaged schema.

### Task 0: Commit the Verified P1 Foundation

**Files:**
- Commit existing: `.gitignore`
- Commit existing: `.github/workflows/validate.yml`
- Commit existing: `README.md`
- Commit existing: `arch-diagram/SKILL.md`
- Commit existing: `arch-diagram/references/patterns.md`
- Commit existing: `flowchart/SKILL.md`
- Commit existing: `flowchart/references/flowchart.md`
- Commit existing: `examples/arch-ecommerce.jsx`
- Commit existing: `examples/arch-flowchart-style.jsx`
- Commit existing: `examples/flowchart-login.jsx`
- Commit existing: `examples/diagrams.js`
- Commit existing: `index.html`
- Commit existing: `package.json`
- Commit existing: `package-lock.json`
- Commit existing: `scripts/package-skills.sh`
- Commit existing: `scripts/validate.mjs`
- Commit existing: `src/App.js`
- Commit existing: `src/main.jsx`
- Commit existing: `src/styles.css`
- Commit existing: `src/diagram/DiagramRenderer.js`
- Commit existing: `src/diagram/geometry.js`
- Commit existing: `src/diagram/schema.js`
- Commit existing: `src/diagram/theme.js`
- Commit existing: `tests/app.test.mjs`
- Commit existing: `tests/examples.test.mjs`
- Commit existing: `tests/geometry.test.mjs`
- Commit existing: `tests/renderer.test.mjs`
- Commit existing: `tests/schema.test.mjs`
- Commit existing: `vite.config.js`

- [ ] **Step 1: Verify the existing foundation before staging it**

Run:

```bash
npm test
npm run build
npm run package:skills
```

Expected: 18 Node tests pass, repository validation reports 91 checks, Vite builds successfully, and both `.skill` archives are produced.

- [ ] **Step 2: Confirm only the known P1 paths are uncommitted**

Run:

```bash
git status --short
```

Expected: only the files listed under Task 0 plus this plan file are shown. Do not stage the plan file in this baseline commit.

- [ ] **Step 3: Stage the P1 foundation explicitly**

Run:

```bash
git add .gitignore .github/workflows/validate.yml README.md arch-diagram/SKILL.md arch-diagram/references/patterns.md flowchart/SKILL.md flowchart/references/flowchart.md examples/arch-ecommerce.jsx examples/arch-flowchart-style.jsx examples/flowchart-login.jsx examples/diagrams.js index.html package.json package-lock.json scripts/package-skills.sh scripts/validate.mjs src/App.js src/main.jsx src/styles.css src/diagram/DiagramRenderer.js src/diagram/geometry.js src/diagram/schema.js src/diagram/theme.js tests/app.test.mjs tests/examples.test.mjs tests/geometry.test.mjs tests/renderer.test.mjs tests/schema.test.mjs vite.config.js
git diff --cached --check
```

Expected: the staged diff has no whitespace errors and `docs/superpowers/plans/2026-07-18-auto-layout-export-schema.md` is not staged.

- [ ] **Step 4: Commit the baseline**

```bash
git commit -m "feat: add shared diagram rendering foundation"
```

Expected: one commit containing the already-verified P1 renderer, examples, tests, validation, and preview.

### Task 1: Centralize the Contract and Relax Position Validation

**Files:**
- Create: `src/diagram/contract.js`
- Modify: `src/diagram/schema.js`
- Modify: `tests/schema.test.mjs`

- [ ] **Step 1: Write failing optional-coordinate and tier tests**

Append to `tests/schema.test.mjs`:

```js
test("validateDiagram accepts omitted dimensions and paired coordinates", () => {
  const issues = validateDiagram({
    kind: "flowchart",
    title: "Automatic",
    nodes: [
      { id: "start", label: "Start", type: "terminal" },
      { id: "done", label: "Done", type: "terminal" },
    ],
    edges: [{ from: "start", to: "done" }],
  });

  assert.deepEqual(issues, []);
});

test("validateDiagram rejects a partial node position", () => {
  const issues = validateDiagram({
    ...validDiagram,
    nodes: [{ id: "start", label: "Start", type: "terminal", x: 20 }],
    edges: [],
  });

  assert.deepEqual(issues.map(({ code }) => code), ["partial-node-position"]);
});

test("validateDiagram checks tier references and force-layout membership", () => {
  const base = {
    kind: "architecture",
    title: "Tiered",
    tiers: [{ id: "client", label: "CLIENT" }],
    nodes: [{ id: "web", label: "Web", type: "client", x: 20, y: 20 }],
    edges: [],
  };

  assert.deepEqual(validateDiagram(base), []);
  assert.deepEqual(
    validateDiagram(base, { layout: "force" }).map(({ code }) => code),
    ["missing-node-tier"],
  );
  assert.deepEqual(
    validateDiagram({ ...base, nodes: [{ ...base.nodes[0], tier: "ghost" }] }).map(({ code }) => code),
    ["unknown-node-tier"],
  );
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run:

```bash
node --test tests/schema.test.mjs
```

Expected: FAIL because missing dimensions and positions are rejected and tier checks do not exist.

- [ ] **Step 3: Add the shared contract module**

Create `src/diagram/contract.js` with:

```js
export const DIAGRAM_KINDS = Object.freeze(["architecture", "flowchart"]);
export const ANCHORS = Object.freeze(["top", "right", "bottom", "left"]);
export const NODE_SHAPES = Object.freeze([
  "rect", "terminal", "decision", "data", "subprocess", "database", "dashed-rect",
]);
export const NODE_TYPES = Object.freeze([
  "client", "cdn", "lb", "security", "gateway", "service", "cache", "database",
  "queue", "search", "external", "terminal", "process", "decision", "data", "sub",
  "state", "highlight", "error",
]);

export const NODE_PRESETS = Object.freeze({
  terminal: { width: 140, height: 44, shape: "terminal" },
  process: { width: 180, height: 48, shape: "rect" },
  decision: { width: 150, height: 76, shape: "decision" },
  data: { width: 180, height: 48, shape: "data" },
  sub: { width: 180, height: 48, shape: "subprocess" },
  state: { width: 180, height: 48, shape: "rect" },
  highlight: { width: 180, height: 48, shape: "rect" },
  error: { width: 160, height: 48, shape: "rect" },
  database: { width: 152, height: 72, shape: "database" },
  external: { width: 152, height: 60, shape: "dashed-rect" },
});

export const DEFAULT_NODE = Object.freeze({ width: 152, height: 60, shape: "rect" });

export function hasOwnPosition(node) {
  return Object.hasOwn(node, "x") && Object.hasOwn(node, "y");
}

export function hasPartialPosition(node) {
  return Object.hasOwn(node, "x") !== Object.hasOwn(node, "y");
}
```

- [ ] **Step 4: Replace runtime validation with optional dimensions and semantic tier checks**

In `src/diagram/schema.js`, import the shared constants, remove the local kind/preset constants, and implement these rules inside `validateDiagram(diagram, options = {})`:

```js
import {
  ANCHORS,
  DEFAULT_NODE,
  DIAGRAM_KINDS,
  NODE_PRESETS,
  NODE_SHAPES,
  NODE_TYPES,
  hasOwnPosition,
  hasPartialPosition,
} from "./contract.js";

export function validateDiagram(diagram, options = {}) {
  const issues = [];
  const layout = options.layout || "missing";

  if (!diagram || typeof diagram !== "object" || Array.isArray(diagram)) {
    return [issue("invalid-diagram", "$", "Diagram must be an object")];
  }
  if (!DIAGRAM_KINDS.includes(diagram.kind)) {
    issues.push(issue("invalid-kind", "kind", "kind must be architecture or flowchart"));
  }
  if (typeof diagram.title !== "string" || diagram.title.length === 0) {
    issues.push(issue("invalid-title", "title", "title must be a non-empty string"));
  }
  for (const key of ["width", "height"]) {
    if (Object.hasOwn(diagram, key) && (!Number.isFinite(diagram[key]) || diagram[key] <= 0)) {
      issues.push(issue(`invalid-${key}`, key, `${key} must be a positive number`));
    }
  }

  const tiers = Array.isArray(diagram.tiers) ? diagram.tiers : [];
  const tierIds = new Set();
  tiers.forEach((tier, index) => {
    const tierPath = `tiers[${index}]`;
    if (!tier || typeof tier !== "object" || typeof tier.id !== "string" || tier.id.length === 0) {
      issues.push(issue("invalid-tier", tierPath, "tier must have a non-empty string id"));
    } else if (tierIds.has(tier.id)) {
      issues.push(issue("duplicate-tier-id", `${tierPath}.id`, `duplicate tier id: ${tier.id}`));
    } else {
      tierIds.add(tier.id);
    }
    if (tier && typeof tier.label !== "string") {
      issues.push(issue("invalid-tier-label", `${tierPath}.label`, "tier label must be a string"));
    }
  });

  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : [];
  if (!Array.isArray(diagram.nodes)) issues.push(issue("invalid-nodes", "nodes", "nodes must be an array"));
  const needsLayout = layout === "force" || nodes.some((node) => node && !hasOwnPosition(node));
  const requireTier = diagram.kind === "architecture" && tiers.length > 0 && needsLayout;
  const ids = new Set();

  nodes.forEach((node, index) => {
    const nodePath = `nodes[${index}]`;
    if (!node || typeof node !== "object") {
      issues.push(issue("invalid-node", nodePath, "node must be an object"));
      return;
    }
    if (typeof node.id !== "string" || node.id.length === 0) {
      issues.push(issue("invalid-node-id", `${nodePath}.id`, "node id must be a non-empty string"));
    } else if (ids.has(node.id)) {
      issues.push(issue("duplicate-node-id", `${nodePath}.id`, `duplicate node id: ${node.id}`));
    } else {
      ids.add(node.id);
    }
    if (typeof node.label !== "string" || node.label.length === 0) {
      issues.push(issue("invalid-node-label", `${nodePath}.label`, "node label must be a non-empty string"));
    }
    if (!NODE_TYPES.includes(node.type)) {
      issues.push(issue("invalid-node-type", `${nodePath}.type`, `unsupported node type: ${node.type}`));
    }
    if (Object.hasOwn(node, "shape") && !NODE_SHAPES.includes(node.shape)) {
      issues.push(issue("invalid-node-shape", `${nodePath}.shape`, `unsupported node shape: ${node.shape}`));
    }
    if (hasPartialPosition(node)) {
      issues.push(issue("partial-node-position", nodePath, "node x and y must be supplied together"));
    } else if (hasOwnPosition(node) && (!Number.isFinite(node.x) || !Number.isFinite(node.y))) {
      issues.push(issue("invalid-node-position", nodePath, "node x and y must be finite numbers"));
    }
    if (Object.hasOwn(node, "tier") && !tierIds.has(node.tier)) {
      issues.push(issue("unknown-node-tier", `${nodePath}.tier`, `unknown tier: ${node.tier}`));
    } else if (requireTier && !Object.hasOwn(node, "tier")) {
      issues.push(issue("missing-node-tier", `${nodePath}.tier`, "tier is required for automatic architecture layout"));
    }
  });

  const edges = Array.isArray(diagram.edges) ? diagram.edges : [];
  if (!Array.isArray(diagram.edges)) issues.push(issue("invalid-edges", "edges", "edges must be an array"));
  edges.forEach((edge, index) => {
    const edgePath = `edges[${index}]`;
    if (!edge || typeof edge !== "object") {
      issues.push(issue("invalid-edge", edgePath, "edge must be an object"));
      return;
    }
    if (!ids.has(edge.from)) issues.push(issue("missing-edge-source", `${edgePath}.from`, `missing edge source: ${edge.from}`));
    if (!ids.has(edge.to)) issues.push(issue("missing-edge-target", `${edgePath}.to`, `missing edge target: ${edge.to}`));
    for (const key of ["fromAnchor", "toAnchor"]) {
      if (Object.hasOwn(edge, key) && !ANCHORS.includes(edge[key])) {
        issues.push(issue("invalid-edge-anchor", `${edgePath}.${key}`, `unsupported anchor: ${edge[key]}`));
      }
    }
  });

  return issues;
}
```

Update `assertDiagram(diagram, options = {})` to pass `options` into `validateDiagram`. Update `normalizeDiagram(diagram, options = {})` to pass `options` into `assertDiagram` and retain optional `width`, `height`, `x`, and `y` while applying presets.

- [ ] **Step 5: Run schema tests and the full suite**

Run:

```bash
node --test tests/schema.test.mjs
npm test
```

Expected: all schema tests pass and the existing repository suite remains green.

- [ ] **Step 6: Commit the contract refactor**

```bash
git add src/diagram/contract.js src/diagram/schema.js tests/schema.test.mjs
git commit -m "feat: allow coordinate-free diagram contracts"
```

### Task 2: Generate and Validate the Draft 2020-12 Schema

**Files:**
- Create: `scripts/schema.mjs`
- Create: `scripts/generate-schema.mjs`
- Create: `schema/diagram.schema.json`
- Create: `tests/schema-json.test.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install the development-only schema validator**

Run:

```bash
npm install --save-dev ajv@^8.17.1
```

Expected: `ajv` appears only in `devDependencies`, and `package-lock.json` updates.

- [ ] **Step 2: Write the failing schema artifact tests**

Create `tests/schema-json.test.mjs`:

```js
import fs from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";

import { ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE, LOGIN_FLOW } from "../examples/diagrams.js";
import { buildDiagramSchema } from "../scripts/schema.mjs";

test("generated JSON Schema is checked in byte-for-byte", () => {
  const actual = fs.readFileSync(new URL("../schema/diagram.schema.json", import.meta.url), "utf8");
  const expected = `${JSON.stringify(buildDiagramSchema(), null, 2)}\n`;
  assert.equal(actual, expected);
});

test("Draft 2020-12 schema validates positioned and coordinate-free diagrams", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(buildDiagramSchema());
  const coordinateFree = {
    kind: "flowchart",
    title: "Generated flow",
    nodes: [
      { id: "start", label: "Start", type: "terminal" },
      { id: "done", label: "Done", type: "terminal" },
    ],
    edges: [{ from: "start", to: "done" }],
  };
  const coordinateFreeArchitecture = {
    kind: "architecture",
    title: "Generated architecture",
    tiers: [{ id: "api", label: "API" }],
    nodes: [{ id: "gateway", label: "Gateway", type: "gateway", tier: "api" }],
    edges: [],
  };

  for (const diagram of [
    ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE, LOGIN_FLOW, coordinateFree, coordinateFreeArchitecture,
  ]) {
    assert.equal(validate(diagram), true, JSON.stringify(validate.errors));
  }
});

test("Draft 2020-12 schema rejects a partial coordinate pair", () => {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(buildDiagramSchema());
  const invalid = {
    kind: "flowchart",
    title: "Invalid",
    nodes: [{ id: "start", label: "Start", type: "terminal", x: 20 }],
    edges: [],
  };

  assert.equal(validate(invalid), false);
  assert.ok(validate.errors.some(({ keyword }) => keyword === "dependentRequired"));
});
```

- [ ] **Step 3: Run the schema test to verify failure**

Run:

```bash
node --test tests/schema-json.test.mjs
```

Expected: FAIL because `scripts/schema.mjs` and the generated artifact do not exist.

- [ ] **Step 4: Implement the deterministic schema builder**

Create `scripts/schema.mjs`. Import `ANCHORS`, `DIAGRAM_KINDS`, `NODE_SHAPES`, and `NODE_TYPES` from `src/diagram/contract.js`. Return a plain object with this top-level structure:

```js
import { ANCHORS, DIAGRAM_KINDS, NODE_SHAPES, NODE_TYPES } from "../src/diagram/contract.js";

const positiveNumber = { type: "number", exclusiveMinimum: 0 };
const finiteNumber = { type: "number" };

export function buildDiagramSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://diagramcraft.dev/schema/diagram.schema.json",
    title: "Diagramcraft Diagram",
    type: "object",
    additionalProperties: false,
    required: ["kind", "title", "nodes", "edges"],
    properties: {
      kind: { enum: [...DIAGRAM_KINDS] },
      title: { type: "string", minLength: 1 },
      subtitle: { type: "string" },
      width: positiveNumber,
      height: positiveNumber,
      nodeDefaults: { $ref: "#/$defs/nodeDefaults" },
      tiers: { type: "array", items: { $ref: "#/$defs/tier" } },
      nodes: { type: "array", items: { $ref: "#/$defs/node" } },
      edges: { type: "array", items: { $ref: "#/$defs/edge" } },
      legend: { type: "array", items: { $ref: "#/$defs/legendItem" } },
    },
    $defs: {
      style: { type: "object", additionalProperties: true },
      nodeDefaults: {
        type: "object",
        additionalProperties: false,
        properties: { width: positiveNumber, height: positiveNumber, shape: { enum: [...NODE_SHAPES] } },
      },
      tier: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string", minLength: 1 }, label: { type: "string" },
          x: finiteNumber, y: finiteNumber, width: positiveNumber, height: positiveNumber,
          color: { type: "string" },
        },
      },
      node: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type"],
        dependentRequired: { x: ["y"], y: ["x"] },
        properties: {
          id: { type: "string", minLength: 1 }, label: { type: "string", minLength: 1 },
          sublabel: { type: "string" }, type: { enum: [...NODE_TYPES] }, tier: { type: "string", minLength: 1 },
          x: finiteNumber, y: finiteNumber, width: positiveNumber, height: positiveNumber,
          shape: { enum: [...NODE_SHAPES] }, fontSize: positiveNumber, style: { $ref: "#/$defs/style" },
        },
      },
      edge: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          id: { type: "string" }, from: { type: "string", minLength: 1 }, to: { type: "string", minLength: 1 },
          label: { type: "string" }, dashed: { type: "boolean" },
          fromAnchor: { enum: [...ANCHORS] }, toAnchor: { enum: [...ANCHORS] },
        },
      },
      legendItem: {
        oneOf: [
          { type: "string", enum: [...NODE_TYPES] },
          {
            type: "object", additionalProperties: false, required: ["type", "label"],
            properties: { type: { enum: [...NODE_TYPES] }, label: { type: "string" } },
          },
        ],
      },
    },
  };
}
```

- [ ] **Step 5: Implement write/check CLI and package scripts**

Create `scripts/generate-schema.mjs`:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDiagramSchema } from "./schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "schema", "diagram.schema.json");
const output = `${JSON.stringify(buildDiagramSchema(), null, 2)}\n`;

if (process.argv.includes("--check")) {
  const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (current !== output) {
    console.error("schema/diagram.schema.json is stale; run npm run schema:generate");
    process.exit(1);
  }
  console.log("JSON Schema is current.");
} else {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, output);
  console.log("Wrote schema/diagram.schema.json");
}
```

Add these scripts to `package.json` and include the check in `test`:

```json
{
  "scripts": {
    "schema:generate": "node scripts/generate-schema.mjs",
    "schema:check": "node scripts/generate-schema.mjs --check",
    "test": "node --test tests/*.test.mjs && node scripts/generate-schema.mjs --check && node scripts/validate.mjs"
  }
}
```

Preserve the existing `dev`, `build`, `test:unit`, `validate`, and `package:skills` scripts.

- [ ] **Step 6: Generate the artifact and run tests**

Run:

```bash
npm run schema:generate
node --test tests/schema-json.test.mjs
npm test
```

Expected: the JSON Schema is written, all schema tests pass, and `schema:check` reports `JSON Schema is current.`

- [ ] **Step 7: Commit generated contract support**

```bash
git add package.json package-lock.json scripts/schema.mjs scripts/generate-schema.mjs schema/diagram.schema.json tests/schema-json.test.mjs
git commit -m "feat: publish generated diagram JSON Schema"
```

### Task 3: Implement Deterministic Flowchart Ranking

**Files:**
- Create: `src/diagram/layout/graph.js`
- Create: `src/diagram/layout/flowchart.js`
- Create: `tests/layout-graph.test.mjs`

- [ ] **Step 1: Write failing graph-ordering tests**

Create `tests/layout-graph.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { analyzeGraph, orderRanks } from "../src/diagram/layout/graph.js";
import { layoutFlowchart } from "../src/diagram/layout/flowchart.js";

const nodes = ["start", "input", "valid", "error", "done"].map((id) => ({
  id, label: id, type: "process", width: 120, height: 48,
}));
const edges = [
  { from: "start", to: "input" },
  { from: "input", to: "valid" },
  { from: "valid", to: "error" },
  { from: "error", to: "input" },
  { from: "valid", to: "done" },
];

test("analyzeGraph removes feedback edges from stable rank assignment", () => {
  const analysis = analyzeGraph(nodes, edges);
  assert.deepEqual([...analysis.feedbackEdgeIndexes], [3]);
  assert.equal(analysis.ranks.get("start"), 0);
  assert.equal(analysis.ranks.get("input"), 1);
  assert.equal(analysis.ranks.get("valid"), 2);
  assert.equal(analysis.ranks.get("done"), 3);
});

test("orderRanks is deterministic for branches", () => {
  const analysis = analyzeGraph(nodes, edges);
  assert.deepEqual(orderRanks(nodes, edges, analysis.ranks, analysis.feedbackEdgeIndexes),
    orderRanks(nodes, edges, analysis.ranks, analysis.feedbackEdgeIndexes));
});

test("orderRanks retains disconnected nodes in source order", () => {
  const disconnected = nodes.slice(0, 3);
  const analysis = analyzeGraph(disconnected, []);
  assert.deepEqual(
    orderRanks(disconnected, [], analysis.ranks, analysis.feedbackEdgeIndexes)[0].map(({ id }) => id),
    ["start", "input", "valid"],
  );
});

test("layoutFlowchart places ranks top-to-bottom and reserves feedback gutter", () => {
  const first = layoutFlowchart({ nodes, edges });
  const second = layoutFlowchart({ nodes, edges });
  const byId = new Map(first.nodes.map((node) => [node.id, node]));

  assert.deepEqual(first, second);
  assert.ok(byId.get("start").y < byId.get("input").y);
  assert.ok(byId.get("input").y < byId.get("valid").y);
  assert.equal(first.edges[3].route, "feedback");
  assert.ok(first.edges[3].gutterX > Math.max(...first.nodes.map((node) => node.x + node.width)));
});
```

- [ ] **Step 2: Run the graph tests to verify failure**

Run:

```bash
node --test tests/layout-graph.test.mjs
```

Expected: FAIL because the graph and flowchart layout modules do not exist.

- [ ] **Step 3: Implement stable feedback detection and ranks**

Create `src/diagram/layout/graph.js` with exports matching the tests. `analyzeGraph(nodes, edges)` must:

```js
export function analyzeGraph(nodes, edges) {
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const outgoing = new Map(nodes.map(({ id }) => [id, []]));
  edges.forEach((edge, index) => {
    if (nodeIds.has(edge.from) && nodeIds.has(edge.to)) outgoing.get(edge.from).push({ edge, index });
  });

  const state = new Map();
  const feedbackEdgeIndexes = new Set();
  function visit(id) {
    state.set(id, "active");
    for (const { edge, index } of outgoing.get(id)) {
      if (state.get(edge.to) === "active") feedbackEdgeIndexes.add(index);
      else if (!state.has(edge.to)) visit(edge.to);
    }
    state.set(id, "done");
  }
  nodes.forEach(({ id }) => {
    if (!state.has(id)) visit(id);
  });

  const indegree = new Map(nodes.map(({ id }) => [id, 0]));
  edges.forEach((edge, index) => {
    if (!feedbackEdgeIndexes.has(index)) indegree.set(edge.to, indegree.get(edge.to) + 1);
  });
  const queue = nodes.filter(({ id }) => indegree.get(id) === 0).map(({ id }) => id);
  const ranks = new Map(nodes.map(({ id }) => [id, 0]));
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const id = queue[cursor];
    for (const { edge, index } of outgoing.get(id)) {
      if (feedbackEdgeIndexes.has(index)) continue;
      ranks.set(edge.to, Math.max(ranks.get(edge.to), ranks.get(id) + 1));
      indegree.set(edge.to, indegree.get(edge.to) - 1);
      if (indegree.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  return { feedbackEdgeIndexes, ranks };
}
```

Implement `orderRanks(nodes, edges, ranks, feedbackEdgeIndexes)` as two stable barycenter sweeps:

```js
export function orderRanks(nodes, edges, ranks, feedbackEdgeIndexes) {
  if (nodes.length === 0) return [];
  const originalIndex = new Map(nodes.map(({ id }, index) => [id, index]));
  const incoming = new Map(nodes.map(({ id }) => [id, []]));
  const outgoing = new Map(nodes.map(({ id }) => [id, []]));
  edges.forEach((edge, index) => {
    if (feedbackEdgeIndexes.has(index)) return;
    incoming.get(edge.to).push(edge.from);
    outgoing.get(edge.from).push(edge.to);
  });
  const maximumRank = Math.max(...ranks.values());
  const grouped = Array.from({ length: maximumRank + 1 }, () => []);
  nodes.forEach((node) => grouped[ranks.get(node.id)].push(node));

  const positions = () => new Map(grouped.flatMap((rank) => rank.map(({ id }, index) => [id, index])));
  const stableSort = (rank, neighbors, neighborPositions) => rank.sort((left, right) => {
    const barycenter = (node) => {
      const values = neighbors.get(node.id)
        .map((id) => neighborPositions.get(id))
        .filter(Number.isFinite);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    };
    const leftCenter = barycenter(left);
    const rightCenter = barycenter(right);
    if (leftCenter !== null && rightCenter !== null && leftCenter !== rightCenter) return leftCenter - rightCenter;
    if (leftCenter !== null && rightCenter === null) return -1;
    if (leftCenter === null && rightCenter !== null) return 1;
    return originalIndex.get(left.id) - originalIndex.get(right.id);
  });

  for (let rank = 1; rank < grouped.length; rank += 1) stableSort(grouped[rank], incoming, positions());
  for (let rank = grouped.length - 2; rank >= 0; rank -= 1) stableSort(grouped[rank], outgoing, positions());
  return grouped;
}
```

- [ ] **Step 4: Implement force flowchart placement**

Create `src/diagram/layout/flowchart.js` using these fixed constants and return shape:

```js
import { analyzeGraph, orderRanks } from "./graph.js";

const OUTER = 36;
const COLUMN_GAP = 48;
const ROW_GAP = 64;
const FEEDBACK_GUTTER = 120;

export function layoutFlowchart(diagram) {
  const analysis = analyzeGraph(diagram.nodes, diagram.edges);
  const ranks = orderRanks(diagram.nodes, diagram.edges, analysis.ranks, analysis.feedbackEdgeIndexes);
  const rankWidths = ranks.map((rank) => rank.reduce((sum, node) => sum + node.width, 0)
    + Math.max(0, rank.length - 1) * COLUMN_GAP);
  const mainWidth = Math.max(568, ...rankWidths);
  const gutter = analysis.feedbackEdgeIndexes.size ? FEEDBACK_GUTTER : 0;
  const width = OUTER * 2 + mainWidth + gutter;
  const positioned = [];
  let y = OUTER;

  ranks.forEach((rank, rankIndex) => {
    const rowHeight = Math.max(...rank.map(({ height }) => height));
    let x = OUTER + (mainWidth - rankWidths[rankIndex]) / 2;
    rank.forEach((node) => {
      positioned.push({ ...node, x, y: y + (rowHeight - node.height) / 2 });
      x += node.width + COLUMN_GAP;
    });
    y += rowHeight + ROW_GAP;
  });

  const height = y - ROW_GAP + OUTER;
  const gutterX = width - OUTER;
  const edges = diagram.edges.map((edge, index) => analysis.feedbackEdgeIndexes.has(index)
    ? { ...edge, route: "feedback", gutterX }
    : { ...edge });
  return { ...diagram, width, height, nodes: positioned, edges };
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
node --test tests/layout-graph.test.mjs
```

Expected: all three graph/layout tests pass with stable ranks and a feedback gutter.

- [ ] **Step 6: Commit flowchart layout primitives**

```bash
git add src/diagram/layout/graph.js src/diagram/layout/flowchart.js tests/layout-graph.test.mjs
git commit -m "feat: add deterministic flowchart ranking"
```

### Task 4: Add Tier Layout, Mixed Placement, and Preparation

**Files:**
- Create: `src/diagram/layout/architecture.js`
- Create: `src/diagram/layout/index.js`
- Create: `tests/layout.test.mjs`
- Modify: `examples/diagrams.js`

- [ ] **Step 1: Add tier IDs to existing architecture data without moving nodes**

In both `ARCH_ECOMMERCE.nodes` and `ARCH_FLOWCHART_STYLE.nodes`, add the matching tier to every node:

```js
const tierByNodeId = {
  web: "client", mobile: "client", admin: "client",
  cdn: "edge", lb: "edge", waf: "edge",
  apigw: "api",
  usersvc: "services", catalog: "services", cart: "services", order: "services",
  notify: "services", recosvc: "services", reco: "services",
  userdb: "data", proddb: "data", orderdb: "data", redis: "data", elastic: "data", kafka: "data",
  stripe: "external", sendgrid: "external", twilio: "external",
};
```

Apply `tier: tierByNodeId[id]` directly to each literal node entry and remove the temporary map; the exported datasets must remain plain serializable objects with unchanged coordinates.

- [ ] **Step 2: Write failing force, mixed, and preservation tests**

Create `tests/layout.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { validateLayout } from "../src/diagram/geometry.js";
import { layoutDiagram, prepareDiagram } from "../src/diagram/layout/index.js";

const architecture = {
  kind: "architecture",
  title: "Tiered",
  tiers: [{ id: "client", label: "CLIENT" }, { id: "api", label: "API" }],
  nodes: [
    { id: "web", label: "Web", type: "client", tier: "client" },
    { id: "mobile", label: "Mobile", type: "client", tier: "client" },
    { id: "gateway", label: "Gateway", type: "gateway", tier: "api" },
  ],
  edges: [{ from: "web", to: "gateway" }, { from: "mobile", to: "gateway" }],
};

test("force layout keeps architecture nodes inside ordered tiers", () => {
  const result = layoutDiagram(architecture, { mode: "force" });
  const tierById = new Map(result.tiers.map((tier) => [tier.id, tier]));
  const nodeById = new Map(result.nodes.map((node) => [node.id, node]));

  assert.ok(tierById.get("client").y < tierById.get("api").y);
  assert.ok(nodeById.get("web").y >= tierById.get("client").y);
  assert.ok(nodeById.get("gateway").y >= tierById.get("api").y);
  assert.deepEqual(validateLayout(result, { padding: 0, gap: 20 }), []);
});

test("missing layout preserves fixed nodes and places only missing nodes", () => {
  const input = {
    kind: "flowchart",
    title: "Mixed",
    width: 500,
    height: 300,
    nodes: [
      { id: "fixed", label: "Fixed", type: "process", x: 30, y: 40 },
      { id: "missing", label: "Missing", type: "process" },
    ],
    edges: [{ from: "fixed", to: "missing" }],
  };
  const result = layoutDiagram(input, { mode: "missing" });
  const fixed = result.nodes.find(({ id }) => id === "fixed");

  assert.deepEqual({ x: fixed.x, y: fixed.y }, { x: 30, y: 40 });
  assert.ok(result.nodes.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y)));
  assert.ok(result.width >= 500);
  assert.ok(result.height >= 300);
});

test("prepareDiagram preserves a complete manual layout", () => {
  const input = {
    kind: "flowchart", title: "Manual", width: 400, height: 240,
    nodes: [{ id: "one", label: "One", type: "process", x: 50, y: 60 }], edges: [],
  };
  const result = prepareDiagram(input);
  assert.equal(result.width, 400);
  assert.equal(result.height, 240);
  assert.deepEqual({ x: result.nodes[0].x, y: result.nodes[0].y }, { x: 50, y: 60 });
});
```

- [ ] **Step 3: Run layout tests to verify failure**

Run:

```bash
node --test tests/layout.test.mjs
```

Expected: FAIL because architecture and orchestration modules do not exist.

- [ ] **Step 4: Implement hard-tier force layout**

Create `src/diagram/layout/architecture.js` with stable tier rows and graph-aware ordering:

```js
import { orderRanks } from "./graph.js";

const OUTER = 24;
const TIER_LABEL_HEIGHT = 28;
const TIER_BOTTOM_PADDING = 18;
const TIER_GAP = 18;
const NODE_GAP = 20;

export function layoutArchitecture(diagram) {
  const tierIndex = new Map(diagram.tiers.map(({ id }, index) => [id, index]));
  const ranks = new Map(diagram.nodes.map(({ id, tier }) => [id, tierIndex.get(tier)]));
  const ordered = orderRanks(diagram.nodes, diagram.edges, ranks, new Set());
  const groups = new Map(diagram.tiers.map(({ id }, index) => [id, ordered[index] || []]));
  const rowWidths = diagram.tiers.map(({ id }) => {
    const nodes = groups.get(id);
    return nodes.reduce((sum, node) => sum + node.width, 0) + Math.max(0, nodes.length - 1) * NODE_GAP;
  });
  const contentWidth = Math.max(672, ...rowWidths);
  const width = contentWidth + OUTER * 2;
  const nodes = [];
  const tiers = [];
  let y = OUTER;

  diagram.tiers.forEach((tier, index) => {
    const members = groups.get(tier.id);
    const rowHeight = members.length ? Math.max(...members.map(({ height }) => height)) : 0;
    const height = TIER_LABEL_HEIGHT + rowHeight + TIER_BOTTOM_PADDING;
    tiers.push({ ...tier, x: 12, y, width: width - 24, height });
    let x = OUTER + (contentWidth - rowWidths[index]) / 2;
    members.forEach((node) => {
      nodes.push({ ...node, x, y: y + TIER_LABEL_HEIGHT + (rowHeight - node.height) / 2 });
      x += node.width + NODE_GAP;
    });
    y += height + TIER_GAP;
  });

  return { ...diagram, width, height: y - TIER_GAP + OUTER, tiers, nodes };
}
```

- [ ] **Step 5: Implement preparation and mixed fixed-node placement**

Create `src/diagram/layout/index.js`. It must export `layoutDiagram` and `prepareDiagram`, normalize before placement, use `layoutArchitecture` for tiered architecture graphs and `layoutFlowchart` otherwise, and reserve fixed nodes in missing mode.

Use this deterministic candidate sequence for each missing node's ideal position:

```js
function* candidateOffsets(step) {
  yield 0;
  for (let index = 1; ; index += 1) {
    yield index * step;
    yield -index * step;
  }
}

function collides(node, placed, gap = 20) {
  return placed.some((other) => node.x < other.x + other.width + gap
    && node.x + node.width + gap > other.x
    && node.y < other.y + other.height + gap
    && node.y + node.height + gap > other.y);
}

function mergeFixedNodes(source, automatic) {
  const sourceById = new Map(source.nodes.map((node) => [node.id, node]));
  const placed = source.nodes.filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  const nodes = automatic.nodes.map((ideal) => {
    const original = sourceById.get(ideal.id);
    if (Number.isFinite(original.x) && Number.isFinite(original.y)) return original;
    for (const offset of candidateOffsets(ideal.width + 20)) {
      const candidate = { ...ideal, x: Math.max(24, ideal.x + offset) };
      if (!collides(candidate, placed)) {
        placed.push(candidate);
        return candidate;
      }
    }
  });
  return nodes;
}
```

After merging, derive `width` and `height` from maximum node/tier/feedback-gutter bounds plus 24px padding. In missing mode use `Math.max(source.width || 0, derivedWidth)` and `Math.max(source.height || 0, derivedHeight)`. In force mode use only derived dimensions. Recompute tier rectangles from merged member bounds for architecture diagrams.

Use these public signatures and preparation guard:

```js
export function layoutDiagram(input, { mode = "missing" } = {}) {
  const source = normalizeDiagram(input, { layout: mode });
  const positioned = source.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  if (positioned && mode === "missing") return fitManualScene(source);
  const automatic = source.kind === "architecture" && source.tiers.length
    ? layoutArchitecture(source)
    : layoutFlowchart(source);
  if (mode === "force") return fitAutomaticScene(automatic);
  return fitMixedScene(source, automatic, mergeFixedNodes(source, automatic));
}

export function prepareDiagram(input, { layout = "missing" } = {}) {
  const result = layoutDiagram(input, { mode: layout });
  const codeMap = {
    "node-overlap": "layout-node-overlap",
    "node-out-of-bounds": "layout-node-out-of-bounds",
  };
  const issues = validateLayout(result, { padding: 0, gap: 0 }).map((entry) => ({
    ...entry,
    code: codeMap[entry.code] || entry.code,
  }));
  if (issues.length) {
    const details = issues.map(({ code, nodeIds }) => `${code}: ${nodeIds.join(", ")}`).join("\n");
    throw new TypeError(`Invalid prepared diagram layout:\n${details}`);
  }
  return result;
}
```

`fitManualScene` derives missing dimensions without moving nodes and preserves supplied dimensions. `fitAutomaticScene` derives tight dimensions from automatically placed nodes, tier bounds, and feedback gutters. `fitMixedScene` uses `Math.max(source.width || 0, derivedWidth)` and the corresponding height, then recomputes architecture tier rectangles from the merged member-node bounds. Add a test with two fixed overlapping nodes and assert that `prepareDiagram` throws `/layout-node-overlap/`.

- [ ] **Step 6: Run layout and example tests**

Run:

```bash
node --test tests/layout.test.mjs tests/examples.test.mjs
npm test
```

Expected: layout tests pass, example coordinates still render, and the full suite remains green.

- [ ] **Step 7: Commit layout orchestration and migration**

```bash
git add src/diagram/layout/architecture.js src/diagram/layout/index.js tests/layout.test.mjs examples/diagrams.js
git commit -m "feat: add tier-aware automatic layout"
```

### Task 5: Integrate Preparation and Feedback Routing

**Files:**
- Modify: `src/diagram/geometry.js`
- Modify: `src/diagram/DiagramRenderer.js`
- Modify: `scripts/validate.mjs`
- Modify: `tests/geometry.test.mjs`
- Modify: `tests/renderer.test.mjs`
- Modify: `tests/examples.test.mjs`

- [ ] **Step 1: Write failing feedback-route and coordinate-free render tests**

Append to `tests/geometry.test.mjs`:

```js
test("routeEdge keeps feedback edges in their outer gutter", () => {
  const route = routeEdge(bottom, top, { route: "feedback", gutterX: 500 });
  assert.equal(route.fromAnchor, "right");
  assert.equal(route.toAnchor, "right");
  assert.equal(route.d, "M 420 270 C 500 270 500 70 220 70");
  assert.deepEqual(route.labelPoint, cubicPoint(route.points, 0.5));
});

test("validateLayout uses prepared-layout issue codes", () => {
  const issues = validateLayout({
    width: 200,
    height: 120,
    nodes: [
      { id: "outside", x: -1, y: 0, width: 40, height: 40 },
      { id: "one", x: 50, y: 50, width: 80, height: 40 },
      { id: "two", x: 100, y: 50, width: 80, height: 40 },
    ],
  }, { padding: 0, gap: 0 });
  assert.deepEqual(issues.map(({ code }) => code), ["layout-node-out-of-bounds", "layout-node-overlap"]);
});
```

Append to `tests/renderer.test.mjs`:

```js
test("DiagramRenderer prepares coordinate-free flowcharts", () => {
  const html = renderToStaticMarkup(React.createElement(DiagramRenderer, {
    diagram: {
      kind: "flowchart",
      title: "Automatic",
      nodes: [
        { id: "start", label: "Start", type: "terminal" },
        { id: "done", label: "Done", type: "terminal" },
      ],
      edges: [{ from: "start", to: "done" }],
    },
  }));
  assert.match(html, /<svg[^>]+viewBox="0 0 \d+ \d+"/);
  assert.match(html, /aria-label="Start"/);
  assert.match(html, /aria-label="Done"/);
});
```

- [ ] **Step 2: Run focused tests to verify failure**

Run:

```bash
node --test tests/geometry.test.mjs tests/renderer.test.mjs
```

Expected: feedback routing and coordinate-free rendering fail.

- [ ] **Step 3: Add feedback routing to `routeEdge`**

At the start of `routeEdge(fromNode, toNode, edge = {})`, before inferred anchors, add:

```js
if (edge.route === "feedback") {
  const start = anchorPoint(fromNode, "right");
  const end = anchorPoint(toNode, "right");
  const gutterX = Math.max(edge.gutterX, start[0] + 28, end[0] + 28);
  const points = {
    start,
    control1: [gutterX, start[1]],
    control2: [gutterX, end[1]],
    end,
  };
  return {
    d: `M ${start[0]} ${start[1]} C ${gutterX} ${start[1]} ${gutterX} ${end[1]} ${end[0]} ${end[1]}`,
    points,
    fromAnchor: "right",
    toAnchor: "right",
    labelPoint: cubicPoint(points, 0.5),
  };
}
```

Rename the two issue codes returned by `validateLayout` to `layout-node-out-of-bounds` and `layout-node-overlap`, then update the original geometry assertion to expect those names.

- [ ] **Step 4: Prepare diagrams at renderer and validation boundaries**

Replace the renderer's `normalizeDiagram(input)` call with:

```js
import { prepareDiagram } from "./layout/index.js";

const diagram = useMemo(() => prepareDiagram(input), [input]);
```

In `scripts/validate.mjs` and `tests/examples.test.mjs`, replace direct `normalizeDiagram(diagram)` preparation with `prepareDiagram(diagram)`. Keep `validateDiagram` calls to report raw-contract issues before layout.

- [ ] **Step 5: Run focused and full tests**

Run:

```bash
node --test tests/geometry.test.mjs tests/renderer.test.mjs tests/examples.test.mjs
npm test
```

Expected: all focused tests pass and repository validation accepts prepared examples.

- [ ] **Step 6: Commit renderer preparation and feedback routing**

```bash
git add src/diagram/geometry.js src/diagram/DiagramRenderer.js scripts/validate.mjs tests/geometry.test.mjs tests/renderer.test.mjs tests/examples.test.mjs
git commit -m "feat: prepare diagrams before shared rendering"
```

### Task 6: Extract the Shared Scene and Render Standalone SVG

**Files:**
- Create: `src/diagram/DiagramScene.js`
- Create: `src/diagram/DiagramDocument.js`
- Create: `src/diagram/export.js`
- Create: `tests/export.test.mjs`
- Modify: `src/diagram/DiagramRenderer.js`
- Modify: `tests/renderer.test.mjs`

- [ ] **Step 1: Write failing clean-SVG tests**

Create `tests/export.test.mjs` with the initial SVG cases:

```js
import test from "node:test";
import assert from "node:assert/strict";

import { documentMetrics } from "../src/diagram/DiagramDocument.js";
import { renderDiagramSvg, safeDiagramFilename } from "../src/diagram/export.js";

const diagram = {
  kind: "flowchart",
  title: "用户 / 登录流程",
  subtitle: "可独立导出",
  width: 420,
  height: 260,
  nodes: [
    { id: "start", label: "开始", type: "terminal", x: 140, y: 30 },
    { id: "done", label: "结束", type: "terminal", x: 140, y: 160 },
  ],
  edges: [{ from: "start", to: "done", label: "继续" }],
  legend: [{ type: "terminal", label: "开始/结束" }],
};

test("renderDiagramSvg creates a complete clean SVG document", () => {
  const svg = renderDiagramSvg(diagram);
  assert.match(svg, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg, />用户 \/ 登录流程<\/text>/);
  assert.match(svg, />可独立导出<\/text>/);
  assert.match(svg, />开始\/结束<\/text>/);
  assert.doesNotMatch(svg, /role="button"|tabindex=|aria-pressed|foreignObject/);
});

test("documentMetrics adds title and legend bands outside the scene", () => {
  const metrics = documentMetrics(diagram);
  assert.equal(metrics.width, 420);
  assert.ok(metrics.sceneY > 0);
  assert.ok(metrics.height > diagram.height + metrics.sceneY);
});

test("safeDiagramFilename keeps Chinese and removes system-invalid characters", () => {
  assert.equal(safeDiagramFilename("用户 / 登录流程", "svg"), "用户-登录流程.svg");
  assert.equal(safeDiagramFilename("  Diagram:*?  ", "png"), "Diagram.png");
});
```

- [ ] **Step 2: Run export tests to verify failure**

Run:

```bash
node --test tests/export.test.mjs
```

Expected: FAIL because the shared scene, document, and export modules do not exist.

- [ ] **Step 3: Extract `DiagramScene` without changing preview output**

Move `shapeElements`, `DiagramNode`, and `DiagramEdge` from `DiagramRenderer.js` into `DiagramScene.js`. Export a `DiagramScene` component with this public interface:

```js
export function DiagramScene({
  diagram,
  selected = null,
  hovered = null,
  onHover = () => {},
  onSelect = () => {},
  interactive = false,
  idPrefix = "diagram",
}) {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const markerId = `${idPrefix}-arrow`;
  const activeMarkerId = `${idPrefix}-arrow-active`;
  return React.createElement(React.Fragment, null, [
    React.createElement("defs", { key: "defs" },
      React.createElement("marker", {
        id: markerId, markerWidth: 8, markerHeight: 6, refX: 7, refY: 3, orient: "auto",
      }, React.createElement("path", { d: "M0,0 L8,3 L0,6 Z", fill: TOKENS.edge }))),
    React.createElement("rect", { key: "canvas", width: diagram.width, height: diagram.height, fill: TOKENS.canvas }),
    ...renderTiers(diagram),
    ...diagram.edges.map((edge, index) => React.createElement(DiagramEdge, {
      key: edge.id || `${edge.from}-${edge.to}-${index}`, edge,
      fromNode: nodeMap.get(edge.from), toNode: nodeMap.get(edge.to), selected, markerId, activeMarkerId,
    })),
    ...diagram.nodes.map((node) => React.createElement(DiagramNode, {
      key: node.id, node, hovered: hovered === node.id, selected: selected === node.id,
      onHover, onSelect, idPrefix, interactive,
    })),
  ]);
}
```

Add a local `renderTiers(diagram)` containing the existing tier SVG markup. In `DiagramNode`, only attach `role`, `tabIndex`, `aria-pressed`, pointer/keyboard handlers, transition, and interactive cursor when `interactive` is true. `DiagramRenderer` renders its existing title/description followed by `DiagramScene` with `interactive: true`; existing renderer tests must stay byte-pattern compatible.

- [ ] **Step 4: Implement SVG document metrics and composition**

Create `src/diagram/DiagramDocument.js`. Export `resolvedLegend(diagram)`, `documentMetrics(diagram)`, and `DiagramDocument`. Use a 76px title band when a subtitle exists, otherwise 58px. Calculate legend columns with `Math.max(1, Math.floor((diagram.width - 48) / 160))`, rows with `Math.ceil(items.length / columns)`, and a 34px row height plus 20px bottom padding.

`DiagramDocument` must return this SVG structure:

```js
return h("svg", {
  xmlns: "http://www.w3.org/2000/svg",
  width: metrics.width,
  height: metrics.height,
  viewBox: `0 0 ${metrics.width} ${metrics.height}`,
  role: "img",
  "aria-labelledby": "export-title export-description",
}, [
  h("title", { id: "export-title", key: "title" }, diagram.title),
  h("desc", { id: "export-description", key: "description" }, diagram.subtitle || `${diagram.title} diagram`),
  h("rect", { key: "background", width: metrics.width, height: metrics.height, fill: TOKENS.canvas }),
  h("text", { key: "heading", x: metrics.width / 2, y: 30, textAnchor: "middle", fontFamily: FONT,
    fontSize: 22, fontWeight: 700, fill: TOKENS.heading }, diagram.title),
  diagram.subtitle ? h("text", { key: "subtitle", x: metrics.width / 2, y: 52, textAnchor: "middle",
    fontFamily: FONT, fontSize: 12, fill: TOKENS.muted }, diagram.subtitle) : null,
  h("g", { key: "scene", transform: `translate(0 ${metrics.sceneY})` },
    h(DiagramScene, { diagram, interactive: false, idPrefix: "export" })),
  h("g", { key: "legend", transform: `translate(0 ${metrics.legendY})` }, renderSvgLegend(diagram, metrics)),
]);
```

Define `FONT` in a shared exported constant in `theme.js` so preview and export use the same stack. `renderSvgLegend` uses `resolvedLegend`, `NODE_STYLES`, and the calculated columns to render a colored 10px circle and text for each item.

- [ ] **Step 5: Implement pure SVG serialization and filenames**

Create the initial `src/diagram/export.js`:

```js
import React from "react";
import { renderToStaticMarkup } from "react-dom/server.browser";

import { DiagramDocument } from "./DiagramDocument.js";
import { prepareDiagram } from "./layout/index.js";

const h = React.createElement;

export function safeDiagramFilename(title, extension) {
  const stem = title.trim()
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "diagram";
  return `${stem}.${extension}`;
}

export function renderDiagramSvg(input) {
  const diagram = prepareDiagram(input);
  const markup = renderToStaticMarkup(h(DiagramDocument, { diagram }));
  return `<?xml version="1.0" encoding="UTF-8"?>${markup}`;
}
```

- [ ] **Step 6: Run renderer and SVG tests**

Run:

```bash
node --test tests/renderer.test.mjs tests/export.test.mjs
npm run build
```

Expected: existing interactive renderer tests pass, clean SVG tests pass, and Vite can bundle the browser static renderer.

- [ ] **Step 7: Commit shared scene and SVG export**

```bash
git add src/diagram/DiagramScene.js src/diagram/DiagramDocument.js src/diagram/DiagramRenderer.js src/diagram/export.js src/diagram/theme.js tests/renderer.test.mjs tests/export.test.mjs
git commit -m "feat: render standalone diagram SVG"
```

### Task 7: Add 2x PNG Rasterization and Download Cleanup

**Files:**
- Modify: `src/diagram/export.js`
- Modify: `tests/export.test.mjs`

- [ ] **Step 1: Write failing PNG and object-URL lifecycle tests**

Append to `tests/export.test.mjs`:

```js
import { rasterizeSvg, downloadBlob } from "../src/diagram/export.js";

test("rasterizeSvg draws an opaque PNG at exactly 2x", async () => {
  const calls = [];
  const context = {
    set fillStyle(value) { calls.push(["fillStyle", value]); },
    fillRect: (...args) => calls.push(["fillRect", ...args]),
    drawImage: (...args) => calls.push(["drawImage", ...args.slice(1)]),
  };
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
  };
  const image = { set src(value) { this.onload({ value }); } };
  const revoked = [];
  const blob = await rasterizeSvg("<svg/>", { width: 420, height: 300 }, {
    createCanvas: () => canvas,
    createImage: () => image,
    createObjectURL: () => "blob:svg",
    revokeObjectURL: (url) => revoked.push(url),
  });

  assert.equal(blob.type, "image/png");
  assert.deepEqual([canvas.width, canvas.height], [840, 600]);
  assert.deepEqual(calls[1], ["fillRect", 0, 0, 840, 600]);
  assert.deepEqual(calls[2], ["drawImage", 0, 0, 840, 600]);
  assert.deepEqual(revoked, ["blob:svg"]);
});

test("rasterizeSvg revokes its SVG URL when decoding fails", async () => {
  const image = { set src(value) { this.onerror({ value }); } };
  const revoked = [];
  await assert.rejects(() => rasterizeSvg("<svg/>", { width: 10, height: 10 }, {
    createCanvas: () => ({ getContext: () => ({}) }),
    createImage: () => image,
    createObjectURL: () => "blob:broken",
    revokeObjectURL: (url) => revoked.push(url),
  }), /Unable to decode/);
  assert.deepEqual(revoked, ["blob:broken"]);
});

test("downloadBlob clicks a temporary link and revokes its URL", () => {
  const events = [];
  const link = { click: () => events.push("click"), remove: () => events.push("remove") };
  const documentApi = { createElement: () => link, body: { append: () => events.push("append") } };
  const urlApi = { createObjectURL: () => "blob:download", revokeObjectURL: (url) => events.push(url) };

  downloadBlob(new Blob(["svg"]), "diagram.svg", { documentApi, urlApi });
  assert.equal(link.download, "diagram.svg");
  assert.deepEqual(events, ["append", "click", "remove", "blob:download"]);
});
```

- [ ] **Step 2: Run export tests to verify failure**

Run:

```bash
node --test tests/export.test.mjs
```

Expected: FAIL because `rasterizeSvg` and `downloadBlob` are not exported.

- [ ] **Step 3: Implement PNG rasterization with injected browser dependencies**

Add to `src/diagram/export.js`:

```js
export async function rasterizeSvg(svg, dimensions, dependencies = {}) {
  const createCanvas = dependencies.createCanvas || (() => document.createElement("canvas"));
  const createImage = dependencies.createImage || (() => new Image());
  const createObjectURL = dependencies.createObjectURL || URL.createObjectURL.bind(URL);
  const revokeObjectURL = dependencies.revokeObjectURL || URL.revokeObjectURL.bind(URL);
  const canvas = createCanvas();
  canvas.width = dimensions.width * 2;
  canvas.height = dimensions.height * 2;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG export requires a 2D canvas context");
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = createObjectURL(svgBlob);

  try {
    const image = createImage();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error("Unable to decode the SVG for PNG export"));
      image.src = url;
    });
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve, reject) => canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("Unable to encode the PNG export")),
      "image/png",
    ));
  } finally {
    revokeObjectURL(url);
  }
}
```

- [ ] **Step 4: Implement synchronous download cleanup and format entry points**

Add:

```js
export function downloadBlob(blob, filename, dependencies = {}) {
  const documentApi = dependencies.documentApi || document;
  const urlApi = dependencies.urlApi || URL;
  const url = urlApi.createObjectURL(blob);
  const link = documentApi.createElement("a");
  link.href = url;
  link.download = filename;
  documentApi.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    urlApi.revokeObjectURL(url);
  }
}

export function downloadDiagramSvg(diagram, dependencies = {}) {
  const svg = renderDiagramSvg(diagram);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob(blob, safeDiagramFilename(diagram.title, "svg"), dependencies);
}

export async function downloadDiagramPng(diagram, dependencies = {}) {
  const prepared = prepareDiagram(diagram);
  const svg = renderDiagramSvg(prepared);
  const metrics = documentMetrics(prepared);
  const blob = await rasterizeSvg(svg, metrics, dependencies);
  downloadBlob(blob, safeDiagramFilename(prepared.title, "png"), dependencies);
}
```

Import `documentMetrics` from `DiagramDocument.js`.

- [ ] **Step 5: Run export tests and production build**

Run:

```bash
node --test tests/export.test.mjs
npm run build
```

Expected: PNG dimensions are exactly 2x, every object URL is revoked, and Vite builds without browser-global evaluation errors.

- [ ] **Step 6: Commit PNG and download support**

```bash
git add src/diagram/export.js tests/export.test.mjs
git commit -m "feat: export diagrams as 2x PNG"
```

### Task 8: Add Reversible Layout and Export Controls

**Files:**
- Modify: `src/App.js`
- Modify: `src/styles.css`
- Modify: `tests/app.test.mjs`

- [ ] **Step 1: Write failing toolbar and state-helper tests**

Extend the import in `tests/app.test.mjs` and append:

```js
import App, { EXAMPLE_OPTIONS, setExampleOverride } from "../src/App.js";

test("preview app exposes layout and export actions with status feedback", () => {
  const html = renderToStaticMarkup(React.createElement(App));
  assert.match(html, />自动重排<\/button>/);
  assert.match(html, />导出 SVG<\/button>/);
  assert.match(html, />导出 PNG<\/button>/);
  assert.match(html, /role="status"/);
});

test("setExampleOverride adds and removes per-example prepared layouts", () => {
  const diagram = { kind: "flowchart", title: "Override", nodes: [], edges: [], width: 300, height: 200 };
  const added = setExampleOverride({}, "flowchart", diagram);
  assert.equal(added.flowchart, diagram);
  assert.deepEqual(setExampleOverride(added, "flowchart", null), {});
});
```

Replace the original default import line rather than leaving two imports from `../src/App.js`.

- [ ] **Step 2: Run app tests to verify failure**

Run:

```bash
node --test tests/app.test.mjs
```

Expected: FAIL because toolbar actions and `setExampleOverride` do not exist.

- [ ] **Step 3: Implement per-example state and action handlers**

Add these imports and helper to `src/App.js`:

```js
import { downloadDiagramPng, downloadDiagramSvg } from "./diagram/export.js";
import { layoutDiagram } from "./diagram/layout/index.js";

export function setExampleOverride(overrides, id, diagram) {
  if (diagram) return { ...overrides, [id]: diagram };
  const next = { ...overrides };
  delete next[id];
  return next;
}
```

Inside `App`, add `overrides` and `status` state. Derive `visibleDiagram` as `overrides[active.id] || active.diagram`. Implement:

```js
const hasOverride = Boolean(overrides[active.id]);
const toggleLayout = () => {
  setOverrides((current) => setExampleOverride(
    current,
    active.id,
    hasOverride ? null : layoutDiagram(active.diagram, { mode: "force" }),
  ));
  setStatus(hasOverride ? "已恢复原布局" : "已完成自动重排");
};

const exportSvg = () => {
  try {
    downloadDiagramSvg(visibleDiagram);
    setStatus("SVG 已导出");
  } catch (error) {
    setStatus(`SVG 导出失败：${error.message}`);
  }
};

const exportPng = async () => {
  try {
    await downloadDiagramPng(visibleDiagram);
    setStatus("PNG 已导出");
  } catch (error) {
    setStatus(`PNG 导出失败：${error.message}`);
  }
};
```

The local `hasOverride` is used for both the next override and status text so the handler does not depend on stale state.

- [ ] **Step 4: Render accessible controls and status**

Wrap `ExampleTabs`, the action group, and status in a right-side toolbar container, then pass `visibleDiagram` to `DiagramRenderer`:

```js
h("div", { className: "toolbar-controls", key: "controls" }, [
  h(ExampleTabs, { key: "tabs", activeId, onChange: setActiveId }),
  h("div", { className: "diagram-actions", key: "actions", "aria-label": "Diagram actions" }, [
    h("button", { key: "layout", type: "button", onClick: toggleLayout },
      hasOverride ? "恢复原布局" : "自动重排"),
    h("button", { key: "svg", type: "button", onClick: exportSvg }, "导出 SVG"),
    h("button", { key: "png", type: "button", onClick: exportPng }, "导出 PNG"),
  ]),
  h("p", { className: "action-status", role: "status", "aria-live": "polite", key: "status" }, status),
]),
```

Keep the tab list and action group as separate focusable regions. On viewports below 820px, allow `.diagram-actions` to wrap. On viewports below 480px, make each action at least 44px high and allow the group to scroll horizontally without shrinking labels.

- [ ] **Step 5: Add high-contrast action styles**

Add `.toolbar-controls`, `.diagram-actions`, `.diagram-actions button`, hover, focus-visible, disabled, and `.action-status` rules to `src/styles.css`. Use the existing indigo `#4f46e5`, white text for the primary layout button, white surfaces with `#cbd5e1` borders for export buttons, and a 3px `rgba(99, 102, 241, 0.28)` focus ring.

- [ ] **Step 6: Run app tests and build**

Run:

```bash
node --test tests/app.test.mjs
npm test
npm run build
```

Expected: app tests find all actions and status semantics, the full suite passes, and the production bundle builds.

- [ ] **Step 7: Commit preview controls**

```bash
git add src/App.js src/styles.css tests/app.test.mjs
git commit -m "feat: add diagram layout and export controls"
```

### Task 9: Package the Schema and Document the New Workflow

**Files:**
- Modify: `scripts/package-skills.sh`
- Modify: `scripts/validate.mjs`
- Modify: `README.md`
- Modify: `arch-diagram/SKILL.md`
- Modify: `flowchart/SKILL.md`
- Modify: `tests/examples.test.mjs`

- [ ] **Step 1: Write failing package/reference checks**

In `scripts/validate.mjs`, add:

```js
const schema = read("schema/diagram.schema.json");
check(schema.includes('"$schema": "https://json-schema.org/draft/2020-12/schema"'),
  "schema/diagram.schema.json: missing Draft 2020-12 declaration");
check(archSkill.includes("diagram.schema.json"),
  "arch-diagram/SKILL.md: shared JSON Schema reference is missing");
check(flowSkill.includes("diagram.schema.json"),
  "flowchart/SKILL.md: shared JSON Schema reference is missing");
```

Append a test to `tests/examples.test.mjs` that asserts every architecture node has a tier matching an existing tier ID:

```js
test("architecture examples declare valid tier membership for force layout", () => {
  for (const diagram of [ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE]) {
    const tierIds = new Set(diagram.tiers.map(({ id }) => id));
    assert.ok(diagram.nodes.every(({ tier }) => tierIds.has(tier)));
  }
});

test("architecture examples can be force-laid out without overlap", () => {
  for (const diagram of [ARCH_ECOMMERCE, ARCH_FLOWCHART_STYLE]) {
    const prepared = prepareDiagram(diagram, { layout: "force" });
    assert.deepEqual(validateLayout(prepared, { padding: 0, gap: 0 }), []);
  }
});
```

Import `prepareDiagram` and `validateLayout` into `tests/examples.test.mjs` for the force-layout assertion.

- [ ] **Step 2: Run validation to verify documentation failure**

Run:

```bash
npm run validate
```

Expected: FAIL because neither skill mentions `diagram.schema.json` yet.

- [ ] **Step 3: Inject the generated schema into both skill packages**

Replace the packaging loop body in `scripts/package-skills.sh` with staging logic:

```bash
for skill in arch-diagram flowchart; do
  STAGED_SKILL="${PACKAGE_TMP}/${skill}"
  mkdir -p "${STAGED_SKILL}/references"
  cp -R "${PROJECT_ROOT}/${skill}/." "${STAGED_SKILL}/"
  cp "${PROJECT_ROOT}/schema/diagram.schema.json" "${STAGED_SKILL}/references/diagram.schema.json"
  (
    cd "${PACKAGE_TMP}"
    zip -qr "${skill}.skill" "${skill}" -x "*/.DS_Store"
  )
  cp "${PACKAGE_TMP}/${skill}.skill" "${OUTPUT_DIR}/${skill}.skill"
  echo "Packaged ${OUTPUT_DIR}/${skill}.skill"
done
```

- [ ] **Step 4: Document coordinate-free input, relayout, export, and schema paths**

In `README.md`, add a concise `Automatic layout and export` section containing this valid example:

```js
const diagram = {
  kind: "architecture",
  title: "Checkout",
  tiers: [
    { id: "api", label: "API" },
    { id: "data", label: "DATA" },
  ],
  nodes: [
    { id: "gateway", label: "API Gateway", type: "gateway", tier: "api" },
    { id: "orders", label: "Orders DB", type: "database", tier: "data" },
  ],
  edges: [{ from: "gateway", to: "orders", label: "SQL" }],
};
```

State that paired `x`/`y` values preserve manual positions, missing positions are placed automatically, and the preview can force/restore a full layout. Link repository consumers to `schema/diagram.schema.json`. In both skill files, instruct machine consumers to use the packaged `references/diagram.schema.json` before rendering shared-contract data.

- [ ] **Step 5: Test packaging contents and repository validation**

Run:

```bash
npm run package:skills
unzip -p dist/arch-diagram.skill arch-diagram/references/diagram.schema.json
unzip -p dist/flowchart.skill flowchart/references/diagram.schema.json
npm test
```

Expected: both `unzip -p` commands print the same Draft 2020-12 schema and the full suite passes.

- [ ] **Step 6: Commit packaging and documentation**

```bash
git add scripts/package-skills.sh scripts/validate.mjs README.md arch-diagram/SKILL.md flowchart/SKILL.md tests/examples.test.mjs
git commit -m "docs: distribute automatic layout schema"
```

### Task 10: Final Production and Browser Verification

**Files:**
- Modify if verification reveals a defect: only the file directly responsible for that defect
- Test: `tests/*.test.mjs`
- Verify: `dist/arch-diagram.skill`
- Verify: `dist/flowchart.skill`

- [ ] **Step 1: Run the complete deterministic suite from a clean process**

Run:

```bash
npm test
npm run build
npm run package:skills
git diff --check
```

Expected: all tests and repository checks pass, Vite builds, both archives package, and the diff has no whitespace errors.

- [ ] **Step 2: Run official skill validation on source directories**

Use the repository's previously verified official `quick_validate.py` environment against `arch-diagram` and `flowchart`.

Expected: both source skills report `Skill is valid!`.

- [ ] **Step 3: Extract archives to a temporary directory and validate packaged skills**

Run the official validator against the extracted `arch-diagram` and `flowchart` directories, then compare their packaged schema bytes:

```bash
cmp extracted/arch-diagram/references/diagram.schema.json extracted/flowchart/references/diagram.schema.json
```

Expected: both packaged skills report `Skill is valid!` and `cmp` exits 0.

- [ ] **Step 4: Verify desktop browser behavior**

Start the Vite preview and verify at 1440x1500:

- all three tabs render without console warnings;
- node mouse and Enter/Space selection still work;
- `自动重排` changes the visible layout and becomes `恢复原布局`;
- switching tabs and returning preserves the override;
- restoring returns the original coordinates;
- SVG download opens independently and contains title, subtitle, graph, and legend;
- PNG dimensions are exactly twice the SVG intrinsic dimensions;
- exported files have no selected/highlighted node state.

- [ ] **Step 5: Verify 390px mobile behavior**

At 390x844, confirm tabs and actions remain keyboard/touch reachable, action labels do not collapse, the diagram frame scrolls horizontally when necessary, downloads complete, and the console remains clean.

- [ ] **Step 6: Fix any verification defect with a focused regression test and commit**

For each observed defect, first add one failing assertion to the most focused existing test file, run that file to reproduce the failure, implement the smallest fix, then rerun the focused test and `npm test`. Confirm `git diff --name-only` contains only the regression test and its responsible tracked implementation file, then run:

```bash
git add -u
git commit -m "fix: resolve diagram export verification defect"
```

Repeat this red-green-commit cycle independently for each defect. Do not broaden the feature set during this step.

- [ ] **Step 7: Commit the implementation plan**

```bash
git add docs/superpowers/plans/2026-07-18-auto-layout-export-schema.md
git commit -m "docs: add automatic layout implementation plan"
```
