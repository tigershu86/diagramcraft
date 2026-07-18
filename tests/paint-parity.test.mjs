import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Ajv2020 from "ajv/dist/2020.js";

import { buildDiagramSchema } from "../scripts/schema.mjs";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { renderDiagramSvg } from "../src/diagram/export.js";
import { prepareDiagram } from "../src/diagram/layout/index.js";
import {
  isSupportedPaint,
  PAINT_MAX_LENGTH,
  PAINT_PATTERN_SOURCE,
} from "../src/diagram/paint.js";
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
  "rgb(10e2 0 0)",
  "rgb(1e308 0 0)",
  "rgb(1.7976931348623157e308 0 0)",
  "rgb(1.7976931348623158e308 0 0)",
  "rgb(10e100 0 0)",
  "rgb(12.3e100 0 0)",
  "rgb(99e200 0 0)",
  `rgb(${"1".repeat(101)}e1 0 0)`,
  "lab(1e999 0 0)",
  "rgb(1e309 0 0)",
  "rgb(1.8e308 0 0)",
  "rgb(1.7976931348623159e308 0 0)",
  `rgb(${"9".repeat(309)} 0 0)`,
  " \t\r\n#AbC \n\r\t",
  "rgb(\t1  \n2\r 3 /\t.5\n)",
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
  `rgb(.${"1".repeat(1025)} 0 0)`,
  "rgb(1e 0 0)",
  "rgb(1e+ 0 0)",
  "rgb(.e2 0 0)",
  "oklch(NaN .2 .25turn)",
  "rgb(Infinity 0 0)",
  "\u000B#abc",
  "#abc\u000C",
  "rgb(1\u000B2 3)",
  "rgb(1 2\u000C3)",
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

test("shared paint grammar bounds every digit and XML whitespace repetition", () => {
  assert.equal(PAINT_MAX_LENGTH, 1024);
  assert.ok(PAINT_PATTERN_SOURCE.length < 25_000, `pattern length: ${PAINT_PATTERN_SOURCE.length}`);
  assert.doesNotMatch(PAINT_PATTERN_SOURCE, /\\d[+*]/);
  assert.doesNotMatch(PAINT_PATTERN_SOURCE, /\[ \\t\\r\\n\][+*]/);
});

test("shared paint validators reject multi-megabyte inputs quickly without throwing", () => {
  const hugeValues = [
    " ".repeat(5_000_000),
    `rgb(1e-${"9".repeat(5_000_000)} 0 0)`,
  ];

  for (const value of hugeValues) {
    const diagram = targets[0].diagram(value);
    const startedAt = performance.now();
    let schemaResult;
    assert.doesNotThrow(() => {
      schemaResult = validateJson(diagram);
    });
    assert.equal(schemaResult, false);
    assert.equal(isSupportedPaint(value), false);
    const elapsed = performance.now() - startedAt;
    assert.ok(elapsed < 2_000, `oversized paint took ${elapsed.toFixed(1)}ms`);
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

test("runtime accepts cross-realm plain styles and safely rejects exotic or hostile objects", () => {
  const crossRealmStyle = runInNewContext('({ fill: "#abc" })');
  const nullPrototypeStyle = Object.assign(Object.create(null), { fill: "#abc" });
  for (const style of [crossRealmStyle, nullPrototypeStyle]) {
    const plainRecordDiagram = {
      ...baseDiagram,
      nodes: [{ ...baseDiagram.nodes[0], style }, baseDiagram.nodes[1]],
    };
    assert.equal(validateJson(plainRecordDiagram), true, JSON.stringify(validateJson.errors));
    assert.deepEqual(validateDiagram(plainRecordDiagram), []);
    assert.doesNotThrow(() => prepareDiagram(plainRecordDiagram));
    assert.doesNotThrow(
      () => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram: plainRecordDiagram })),
    );
    assert.doesNotThrow(() => renderDiagramSvg(plainRecordDiagram));
  }

  class StyleInstance {
    constructor() {
      this.fill = "#abc";
    }
  }
  const { proxy: revokedStyle, revoke } = Proxy.revocable({ fill: "#abc" }, {});
  revoke();
  const hostileStyles = [
    null,
    [],
    new Date(),
    new Map(),
    new StyleInstance(),
    revokedStyle,
    new Proxy({}, { getPrototypeOf() { throw new Error("hostile prototype"); } }),
    new Proxy({}, { ownKeys() { throw new Error("hostile keys"); } }),
  ];

  for (const style of hostileStyles) {
    const diagram = {
      ...baseDiagram,
      nodes: [{ ...baseDiagram.nodes[0], style }, baseDiagram.nodes[1]],
    };
    assert.doesNotThrow(() => validateDiagram(diagram));
    assert.ok(validateDiagram(diagram).some(({ code, path }) => (
      code === "invalid-node-style" && path === "nodes[0].style"
    )));
    assert.throws(() => prepareDiagram(diagram), /invalid-node-style[\s\S]*nodes\[0\]\.style/);
  }
});

test("preparation snapshots a stateful style field exactly once before validation and rendering", () => {
  for (const secondValue of ["url(#escaped)", 42]) {
    let fillReads = 0;
    const style = new Proxy({ fill: "#abc" }, {
      get(target, key, receiver) {
        if (key !== "fill") return Reflect.get(target, key, receiver);
        fillReads += 1;
        return fillReads === 1 ? "#abc" : secondValue;
      },
    });
    const input = {
      ...baseDiagram,
      nodes: [{ ...baseDiagram.nodes[0], style }, baseDiagram.nodes[1]],
    };

    const prepared = prepareDiagram(input);
    assert.equal(fillReads, 1);
    assert.notEqual(prepared.nodes[0].style, style);
    assert.equal(Object.getPrototypeOf(prepared.nodes[0].style), Object.prototype);
    assert.deepEqual(prepared.nodes[0].style, { fill: "#abc" });
    const preview = renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram: prepared }));
    const exported = renderDiagramSvg(prepared);
    assert.equal(fillReads, 1);
    assert.match(preview, /fill="#abc"/);
    assert.match(exported, /fill="#abc"/);
    assert.doesNotMatch(preview, /url\(#escaped\)|fill="42"/);
    assert.doesNotMatch(exported, /url\(#escaped\)|fill="42"/);
  }
});

test("prepared styles are independent snapshots of ordinary caller objects", () => {
  const style = { fill: "#abc", stroke: "#123456" };
  const input = {
    ...baseDiagram,
    nodes: [{ ...baseDiagram.nodes[0], style }, baseDiagram.nodes[1]],
  };
  const prepared = prepareDiagram(input);
  style.fill = "url(#late-mutation)";
  style.stroke = 42;

  assert.deepEqual(prepared.nodes[0].style, { fill: "#abc", stroke: "#123456" });
  assert.match(renderDiagramSvg(prepared), /fill="#abc"/);
  assert.doesNotMatch(renderDiagramSvg(prepared), /late-mutation|stroke="42"/);
});

test("style snapshot failures become stable invalid-node-style diagnostics", () => {
  const throwing = (trap) => new Proxy({ fill: "#abc" }, {
    [trap]() { throw new Error(`hostile ${trap}`); },
  });
  const unstableDescriptor = new Proxy({ fill: "#abc" }, {
    ownKeys() { return ["fill"]; },
    getOwnPropertyDescriptor() { return undefined; },
  });
  const symbolStyle = { fill: "#abc", [Symbol("hidden")]: "url(#escaped)" };
  const duplicateKeys = new Proxy({ fill: "#abc" }, {
    ownKeys() { return ["fill", "fill"]; },
  });
  const hostileStyles = [
    throwing("ownKeys"),
    throwing("getOwnPropertyDescriptor"),
    throwing("get"),
    unstableDescriptor,
    duplicateKeys,
    symbolStyle,
  ];

  for (const style of hostileStyles) {
    const diagram = {
      ...baseDiagram,
      nodes: [{ ...baseDiagram.nodes[0], style }, baseDiagram.nodes[1]],
    };
    assert.throws(() => prepareDiagram(diagram), /invalid-node-style[\s\S]*nodes\[0\]\.style/);
    assert.throws(
      () => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram })),
      /invalid-node-style[\s\S]*nodes\[0\]\.style/,
    );
    assert.throws(() => renderDiagramSvg(diagram), /invalid-node-style[\s\S]*nodes\[0\]\.style/);
  }
});

test("preparation snapshots a stateful tier color exactly once before validation and rendering", () => {
  for (const laterColor of ["url(#escaped-tier)", 42]) {
    let colorReads = 0;
    const tier = new Proxy({ ...baseDiagram.tiers[0], color: "#abc" }, {
      get(target, key, receiver) {
        if (key !== "color") return Reflect.get(target, key, receiver);
        colorReads += 1;
        return colorReads === 1 ? "#abc" : laterColor;
      },
    });
    const input = { ...baseDiagram, tiers: [tier] };

    const prepared = prepareDiagram(input);
    assert.equal(colorReads, 1);
    assert.notEqual(prepared.tiers[0], tier);
    assert.equal(Object.getPrototypeOf(prepared.tiers[0]), Object.prototype);
    assert.equal(prepared.tiers[0].color, "#abc");
    const preview = renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram: prepared }));
    const exported = renderDiagramSvg(prepared);
    assert.equal(colorReads, 1);
    assert.match(preview, /fill="#abc"/);
    assert.match(exported, /fill="#abc"/);
    assert.doesNotMatch(preview, /escaped-tier|fill="42"/);
    assert.doesNotMatch(exported, /escaped-tier|fill="42"/);
  }
});

test("prepared tiers and their array are isolated from caller mutation", () => {
  const tier = { ...baseDiagram.tiers[0], color: "#abc" };
  const tiers = [tier];
  const prepared = prepareDiagram({ ...baseDiagram, tiers });
  const expectedTier = { ...prepared.tiers[0] };

  tier.id = "mutated";
  tier.label = "Mutated";
  tier.x = 999;
  tier.y = 999;
  tier.width = 1;
  tier.height = 1;
  tier.color = "url(#late-tier-mutation)";
  tiers.push({ id: "late", label: "Late" });

  assert.notEqual(prepared.tiers, tiers);
  assert.deepEqual(prepared.tiers, [expectedTier]);
  const exported = renderDiagramSvg(prepared);
  assert.doesNotMatch(exported, /late-tier-mutation|Mutated|>Late</);
  assert.match(exported, /fill="#abc"/);
});

test("tier snapshots accept plain realms and reject exotic or hostile records", () => {
  const crossRealmTier = runInNewContext(`(${JSON.stringify({ ...baseDiagram.tiers[0], color: "#abc" })})`);
  const nullPrototypeTier = Object.assign(Object.create(null), baseDiagram.tiers[0], { color: "#abc" });
  for (const tier of [crossRealmTier, nullPrototypeTier]) {
    const diagram = { ...baseDiagram, tiers: [tier] };
    assert.equal(validateJson(diagram), true, JSON.stringify(validateJson.errors));
    assert.deepEqual(validateDiagram(diagram), []);
    assert.doesNotThrow(() => prepareDiagram(diagram));
    assert.doesNotThrow(() => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram })));
    assert.doesNotThrow(() => renderDiagramSvg(diagram));
  }

  class TierInstance {
    constructor() {
      Object.assign(this, baseDiagram.tiers[0], { color: "#abc" });
    }
  }
  const throwing = (trap) => new Proxy({ ...baseDiagram.tiers[0], color: "#abc" }, {
    [trap]() { throw new Error(`hostile tier ${trap}`); },
  });
  const unstableDescriptor = new Proxy({ ...baseDiagram.tiers[0], color: "#abc" }, {
    ownKeys() { return ["id", "label", "x", "y", "width", "height", "color"]; },
    getOwnPropertyDescriptor() { return undefined; },
  });
  const duplicateKeys = new Proxy({ ...baseDiagram.tiers[0], color: "#abc" }, {
    ownKeys() { return ["id", "id"]; },
  });
  const symbolTier = { ...baseDiagram.tiers[0], color: "#abc", [Symbol("hidden")]: "url(#escaped)" };
  const { proxy: revokedTier, revoke } = Proxy.revocable({ ...baseDiagram.tiers[0], color: "#abc" }, {});
  revoke();
  const hostileTiers = [
    null,
    [],
    new Date(),
    new Map(),
    new TierInstance(),
    revokedTier,
    throwing("ownKeys"),
    throwing("getOwnPropertyDescriptor"),
    throwing("get"),
    unstableDescriptor,
    duplicateKeys,
    symbolTier,
  ];

  for (const tier of hostileTiers) {
    const diagram = { ...baseDiagram, tiers: [tier] };
    assert.throws(() => prepareDiagram(diagram), /invalid-tier at tiers\[0\]/);
    assert.throws(
      () => renderToStaticMarkup(React.createElement(DiagramRenderer, { diagram })),
      /invalid-tier at tiers\[0\]/,
    );
    assert.throws(() => renderDiagramSvg(diagram), /invalid-tier at tiers\[0\]/);
  }

  const unknownTierField = {
    ...baseDiagram,
    tiers: [{ ...baseDiagram.tiers[0], color: "#abc", shadow: "red" }],
  };
  assert.deepEqual(validateDiagram(unknownTierField).filter(({ code }) => code === "unknown-tier-field"), [{
    code: "unknown-tier-field",
    path: "tiers[0].shadow",
    message: "tier field shadow is not supported",
  }]);
});
