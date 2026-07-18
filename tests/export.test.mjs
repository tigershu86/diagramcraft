import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  DiagramDocument,
  documentMetrics,
  resolvedLegend,
} from "../src/diagram/DiagramDocument.js";
import {
  downloadBlob,
  downloadDiagramPng,
  downloadDiagramSvg,
  rasterizeSvg,
  renderDiagramSvg,
  safeDiagramFilename,
} from "../src/diagram/export.js";
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

async function captureRejection(promise) {
  try {
    return { rejected: false, value: await promise };
  } catch (reason) {
    return { rejected: true, reason };
  }
}

function captureThrow(action) {
  try {
    return { threw: false, value: action() };
  } catch (reason) {
    return { threw: true, reason };
  }
}

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

test("rasterizeSvg paints an exact 2x white PNG and revokes its SVG URL", async () => {
  const events = [];
  const image = {};
  const context = {
    set fillStyle(value) { events.push(["fillStyle", value]); },
    fillRect(...args) { events.push(["fillRect", ...args]); },
    drawImage(...args) { events.push(["drawImage", ...args]); },
  };
  const canvas = {
    getContext(type) {
      events.push(["getContext", type]);
      return context;
    },
    toBlob(callback, type) {
      events.push(["toBlob", type]);
      callback(new Blob(["png"], { type: "image/png" }));
    },
  };
  Object.defineProperty(image, "src", {
    set(value) {
      events.push(["src", value]);
      queueMicrotask(() => image.onload());
    },
  });
  let svgBlob;
  const result = await rasterizeSvg("<svg><rect/></svg>", { width: 420, height: 300 }, {
    get urlApi() { throw new Error("unused urlApi accessed"); },
    createCanvas: () => canvas,
    createImage: () => image,
    createObjectURL(blob) {
      svgBlob = blob;
      events.push(["createObjectURL", blob.type]);
      return "blob:svg";
    },
    revokeObjectURL(url) { events.push(["revokeObjectURL", url]); },
  });

  assert.equal(canvas.width, 840);
  assert.equal(canvas.height, 600);
  assert.equal(result.type, "image/png");
  assert.equal(svgBlob.type, "image/svg+xml;charset=utf-8");
  assert.equal(await svgBlob.text(), "<svg><rect/></svg>");
  assert.deepEqual(events, [
    ["getContext", "2d"],
    ["createObjectURL", "image/svg+xml;charset=utf-8"],
    ["src", "blob:svg"],
    ["fillStyle", "#FFFFFF"],
    ["fillRect", 0, 0, 840, 600],
    ["drawImage", image, 0, 0, 840, 600],
    ["toBlob", "image/png"],
    ["revokeObjectURL", "blob:svg"],
  ]);
});

test("rasterizeSvg rejects invalid input before allocating an object URL", async () => {
  const invalid = [
    ["", { width: 1, height: 1 }],
    ["   ", { width: 1, height: 1 }],
    [42, { width: 1, height: 1 }],
    ["<svg/>", null],
    ["<svg/>", { width: 0, height: 1 }],
    ["<svg/>", { width: 1, height: Number.POSITIVE_INFINITY }],
  ];
  let allocations = 0;
  const dependencies = {
    createCanvas: () => ({ getContext: () => ({}) }),
    createImage: () => { throw new Error("unexpected image allocation"); },
    createObjectURL() { allocations += 1; return "blob:invalid"; },
    revokeObjectURL() {},
  };

  for (const [svg, dimensions] of invalid) {
    await assert.rejects(
      () => rasterizeSvg(svg, dimensions, dependencies),
      /SVG|dimensions|width|height|positive|integer/i,
    );
  }
  assert.equal(allocations, 0);
});

test("rasterizeSvg rounds fractional doubled dimensions to positive pixel integers", async () => {
  const canvas = {
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
  };
  const image = {};
  Object.defineProperty(image, "src", {
    set() { queueMicrotask(() => image.onload()); },
  });

  await rasterizeSvg("<svg/>", { width: 10.25, height: 4.1 }, {
    createCanvas: () => canvas,
    createImage: () => image,
    createObjectURL: () => "blob:fractional",
    revokeObjectURL() {},
  });

  assert.equal(canvas.width, 21);
  assert.equal(canvas.height, 8);
});

test("rasterizeSvg rejects unsafe canvas capacities before allocating a URL", async () => {
  const cases = [
    [{ width: Number.MAX_VALUE, height: 1 }, /finite|safe integer/i],
    [{ width: 16_384, height: 0.5 }, /maximum dimension|32767/i],
    [{ width: 2_048.5, height: 2_048 }, /maximum area|16777216/i],
  ];

  for (const [dimensions, message] of cases) {
    let urlAllocations = 0;
    await assert.rejects(
      () => rasterizeSvg("<svg/>", dimensions, {
        createCanvas: () => ({ getContext: () => ({}) }),
        createObjectURL() { urlAllocations += 1; return "blob:unsafe"; },
        revokeObjectURL() {},
      }),
      message,
    );
    assert.equal(urlAllocations, 0);
  }
});

test("rasterizeSvg rejects a canvas that cannot retain the requested dimensions before URL allocation", async () => {
  let urlAllocations = 0;
  const canvas = {
    get width() { return 0; },
    set width(_value) {},
    get height() { return 0; },
    set height(_value) {},
    getContext: () => ({ mind: "unused" }),
  };

  await assert.rejects(
    () => rasterizeSvg("<svg/>", { width: 100, height: 50 }, {
      createCanvas: () => canvas,
      createObjectURL() { urlAllocations += 1; return "blob:zero"; },
      revokeObjectURL() {},
    }),
    /Unable to allocate 200x100 PNG canvas/,
  );
  assert.equal(urlAllocations, 0);
});

test("rasterizeSvg accepts canvas dimension and area boundaries", async () => {
  for (const dimensions of [
    { width: 16_383.5, height: 0.5 },
    { width: 2_048, height: 2_048 },
  ]) {
    const canvas = {
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob: (callback) => callback(new Blob(["png"], { type: "image/png" })),
    };
    const image = {};
    Object.defineProperty(image, "src", {
      set() { queueMicrotask(() => image.onload()); },
    });

    await rasterizeSvg("<svg/>", dimensions, {
      createCanvas: () => canvas,
      createImage: () => image,
      createObjectURL: () => "blob:boundary",
      revokeObjectURL() {},
    });
  }
});

test("rasterizeSvg reports a missing 2D context without creating or revoking a URL", async () => {
  let created = 0;
  let revoked = 0;

  await assert.rejects(
    () => rasterizeSvg("<svg/>", { width: 10, height: 20 }, {
      createCanvas: () => ({ getContext: () => null }),
      createObjectURL() { created += 1; return "blob:unused"; },
      revokeObjectURL() { revoked += 1; },
    }),
    /PNG export requires a 2D canvas context/,
  );
  assert.equal(created, 0);
  assert.equal(revoked, 0);
});

test("rasterizeSvg revokes the SVG URL when image decoding fails", async () => {
  const revoked = [];
  const image = {};
  Object.defineProperty(image, "src", {
    set() { queueMicrotask(() => image.onerror(new Error("decode"))); },
  });

  await assert.rejects(
    () => rasterizeSvg("<svg/>", { width: 10, height: 20 }, {
      createCanvas: () => ({ getContext: () => ({}) }),
      createImage: () => image,
      createObjectURL: () => "blob:decode",
      revokeObjectURL: (url) => revoked.push(url),
    }),
    /Unable to decode the SVG for PNG export/,
  );
  assert.deepEqual(revoked, ["blob:decode"]);
  assert.equal(image.onload, null);
  assert.equal(image.onerror, null);
});

test("rasterizeSvg revokes the SVG URL when image creation or src assignment throws", async () => {
  for (const [name, createImage] of [
    ["createImage", () => { throw new Error("create image failed"); }],
    ["src", () => Object.defineProperty({}, "src", {
      set() { throw new Error("src failed"); },
    })],
  ]) {
    const revoked = [];
    await assert.rejects(
      () => rasterizeSvg("<svg/>", { width: 10, height: 20 }, {
        createCanvas: () => ({ getContext: () => ({}) }),
        createImage,
        createObjectURL: () => `blob:${name}`,
        revokeObjectURL: (url) => revoked.push(url),
      }),
      new RegExp(`${name === "src" ? "src" : "create image"} failed`),
    );
    assert.deepEqual(revoked, [`blob:${name}`]);
  }
});

test("rasterizeSvg revokes the SVG URL when drawing or PNG encoding fails", async () => {
  for (const [name, context, toBlob, message] of [
    ["draw", { fillRect() {}, drawImage() { throw new Error("draw failed"); } }, () => {}, /draw failed/],
    ["null", { fillRect() {}, drawImage() {} }, (callback) => callback(null), /Unable to encode the PNG export/],
    ["throw", { fillRect() {}, drawImage() {} }, () => { throw new Error("encode threw"); }, /Unable to encode the PNG export/],
  ]) {
    const revoked = [];
    const image = {};
    Object.defineProperty(image, "src", {
      set() { queueMicrotask(() => image.onload()); },
    });
    await assert.rejects(
      () => rasterizeSvg("<svg/>", { width: 10, height: 20 }, {
        createCanvas: () => ({ getContext: () => context, toBlob }),
        createImage: () => image,
        createObjectURL: () => `blob:${name}`,
        revokeObjectURL: (url) => revoked.push(url),
      }),
      message,
    );
    assert.deepEqual(revoked, [`blob:${name}`]);
  }
});

test("rasterizeSvg preserves decode, draw, and encode failures when URL cleanup also fails", async () => {
  for (const mode of ["decode", "draw", "encode"]) {
    const image = {};
    Object.defineProperty(image, "src", {
      set() {
        queueMicrotask(() => {
          if (mode === "decode") image.onerror();
          else image.onload();
        });
      },
    });
    const context = {
      fillRect() {},
      drawImage() {
        if (mode === "draw") throw new Error("draw primary failed");
      },
    };
    const canvas = {
      getContext: () => context,
      toBlob(callback) { callback(mode === "encode" ? null : new Blob(["png"])); },
    };

    await assert.rejects(
      () => rasterizeSvg("<svg/>", { width: 10, height: 10 }, {
        createCanvas: () => canvas,
        createImage: () => image,
        createObjectURL: () => `blob:${mode}`,
        revokeObjectURL() { throw new Error(`${mode} cleanup failed`); },
      }),
      (error) => {
        const primary = mode === "decode"
          ? "Unable to decode the SVG for PNG export"
          : mode === "draw"
            ? "draw primary failed"
            : "Unable to encode the PNG export";
        assert.match(error.message, new RegExp(primary));
        assert.equal(error.cause?.message, primary);
        assert.deepEqual(error.errors?.map((entry) => entry.message), [
          primary,
          `${mode} cleanup failed`,
        ]);
        return true;
      },
    );
  }
});

test("rasterizeSvg throws a cleanup failure after a successful PNG encode", async () => {
  const image = {};
  Object.defineProperty(image, "src", {
    set() { queueMicrotask(() => image.onload()); },
  });
  await assert.rejects(
    () => rasterizeSvg("<svg/>", { width: 10, height: 10 }, {
      createCanvas: () => ({
        getContext: () => ({ fillRect() {}, drawImage() {} }),
        toBlob: (callback) => callback(new Blob(["png"])),
      }),
      createImage: () => image,
      createObjectURL: () => "blob:cleanup",
      revokeObjectURL() { throw new Error("revoke cleanup failed"); },
    }),
    /revoke cleanup failed/,
  );
});

test("rasterizeSvg rejects with the exact falsy value thrown while drawing", async () => {
  for (const primary of [undefined, ""]) {
    const image = {};
    Object.defineProperty(image, "src", {
      set() { queueMicrotask(() => image.onload()); },
    });
    const outcome = await captureRejection(rasterizeSvg("<svg/>", { width: 10, height: 10 }, {
      createCanvas: () => ({
        getContext: () => ({
          fillRect() {},
          drawImage() { throw primary; },
        }),
      }),
      createImage: () => image,
      createObjectURL: () => "blob:falsy-draw",
      revokeObjectURL() {},
    }));

    assert.equal(outcome.rejected, true);
    assert.equal(outcome.reason, primary);
  }
});

test("rasterizeSvg aggregates a falsy draw failure with URL cleanup failure", async () => {
  const events = [];
  const image = {};
  Object.defineProperty(image, "src", {
    set() { queueMicrotask(() => image.onload()); },
  });
  const outcome = await captureRejection(rasterizeSvg("<svg/>", { width: 10, height: 10 }, {
    createCanvas: () => ({
      getContext: () => ({
        fillRect() {},
        drawImage() { throw undefined; },
      }),
    }),
    createImage: () => image,
    createObjectURL: () => "blob:falsy-cleanup",
    revokeObjectURL() {
      events.push("revoke");
      throw new Error("falsy revoke failed");
    },
  }));

  assert.equal(outcome.rejected, true);
  assert.ok(outcome.reason instanceof AggregateError);
  assert.equal(outcome.reason.message, "undefined");
  assert.equal(outcome.reason.cause, undefined);
  assert.equal(outcome.reason.errors[0], undefined);
  assert.equal(outcome.reason.errors[1].message, "falsy revoke failed");
  assert.deepEqual(events, ["revoke"]);
});

test("object URL direct dependencies must be provided as an atomic pair", () => {
  for (const direct of [
    { createObjectURL() { throw new Error("create called"); } },
    { revokeObjectURL() { throw new Error("revoke called"); } },
  ]) {
    let urlApiCalls = 0;
    assert.throws(
      () => downloadBlob(new Blob(["x"]), "x.svg", {
        ...direct,
        urlApi: {
          createObjectURL() { urlApiCalls += 1; return "blob:mixed"; },
          revokeObjectURL() { urlApiCalls += 1; },
        },
        document: { createElement() { throw new Error("document called"); } },
      }),
      /createObjectURL and revokeObjectURL must be provided together/,
    );
    assert.equal(urlApiCalls, 0);
  }
});

test("object URL dependencies use a complete bound urlApi when direct methods are absent", () => {
  const events = [];
  const urlApi = {
    createObjectURL() {
      assert.equal(this, urlApi);
      events.push("create");
      return "blob:url-api";
    },
    revokeObjectURL(source) {
      assert.equal(this, urlApi);
      events.push(`revoke:${source}`);
    },
  };
  const link = { click() { events.push("click"); }, remove() { events.push("remove"); } };

  downloadBlob(new Blob(["x"]), "x.svg", {
    urlApi,
    document: {
      createElement: () => link,
      body: { append() { events.push("append"); } },
    },
  });

  assert.deepEqual(events, ["create", "append", "click", "remove", "revoke:blob:url-api"]);
});

test("object URL dependencies reject an incomplete urlApi without invoking it", () => {
  let calls = 0;
  assert.throws(
    () => downloadBlob(new Blob(["x"]), "x.svg", {
      urlApi: { createObjectURL() { calls += 1; return "blob:incomplete"; } },
      document: { createElement() { calls += 1; return {}; } },
    }),
    /URL API requires createObjectURL and revokeObjectURL functions/,
  );
  assert.equal(calls, 0);
});

test("downloadBlob clicks a temporary link and cleans it up in order", () => {
  const events = [];
  const link = {
    click() { events.push("click"); },
    remove() { events.push("remove"); },
  };
  const blob = new Blob(["diagram"]);

  downloadBlob(blob, "safe.svg", {
    createObjectURL(value) { assert.equal(value, blob); return "blob:download"; },
    revokeObjectURL(url) { events.push(`revoke:${url}`); },
    document: {
      createElement(tag) { assert.equal(tag, "a"); return link; },
      body: { append(value) { assert.equal(value, link); events.push("append"); } },
    },
  });

  assert.equal(link.href, "blob:download");
  assert.equal(link.download, "safe.svg");
  assert.deepEqual(events, ["append", "click", "remove", "revoke:blob:download"]);
});

test("downloadBlob revokes its URL and removes any created link on setup or click failure", () => {
  for (const mode of ["createElement", "append", "click", "remove"]) {
    const events = [];
    const link = {
      click() {
        events.push("click");
        if (mode === "click") throw new Error("click failed");
      },
      remove() {
        events.push("remove");
        if (mode === "remove") throw new Error("remove failed");
      },
    };
    assert.throws(
      () => downloadBlob(new Blob(["x"]), "x.svg", {
        createObjectURL: () => `blob:${mode}`,
        revokeObjectURL(url) { events.push(`revoke:${url}`); },
        document: {
          createElement() {
            if (mode === "createElement") throw new Error("createElement failed");
            return link;
          },
          body: {
            append() {
              events.push("append");
              if (mode === "append") throw new Error("append failed");
            },
          },
        },
      }),
      new RegExp(`${mode} failed`),
    );
    assert.equal(events.at(-1), `revoke:blob:${mode}`);
    if (mode !== "createElement") assert.ok(events.includes("remove"));
  }
});

test("downloadBlob preserves append and click failures while reporting every cleanup failure", () => {
  for (const mode of ["append", "click"]) {
    const events = [];
    const link = {
      click() {
        events.push("click");
        if (mode === "click") throw new Error("click primary failed");
      },
      remove() {
        events.push("remove");
        throw new Error("remove cleanup failed");
      },
    };

    assert.throws(
      () => downloadBlob(new Blob(["x"]), "x.svg", {
        createObjectURL: () => "blob:aggregate",
        revokeObjectURL() {
          events.push("revoke");
          throw new Error("revoke cleanup failed");
        },
        document: {
          createElement: () => link,
          body: {
            append() {
              events.push("append");
              if (mode === "append") throw new Error("append primary failed");
            },
          },
        },
      }),
      (error) => {
        const primary = `${mode} primary failed`;
        assert.equal(error.message, primary);
        assert.equal(error.cause?.message, primary);
        assert.deepEqual(error.errors?.map((entry) => entry.message), [
          primary,
          "remove cleanup failed",
          "revoke cleanup failed",
        ]);
        return true;
      },
    );
    assert.deepEqual(events, mode === "append"
      ? ["append", "remove", "revoke"]
      : ["append", "click", "remove", "revoke"]);
  }
});

test("downloadBlob throws cleanup failures even when append and click succeed", () => {
  const link = { click() {}, remove() {} };
  assert.throws(
    () => downloadBlob(new Blob(["x"]), "x.svg", {
      createObjectURL: () => "blob:cleanup-only",
      revokeObjectURL() { throw new Error("download revoke failed"); },
      document: { createElement: () => link, body: { append() {} } },
    }),
    /download revoke failed/,
  );
});

test("downloadBlob throws the exact null and zero values from link.click", () => {
  for (const primary of [null, 0]) {
    const outcome = captureThrow(() => downloadBlob(new Blob(["x"]), "x.svg", {
      createObjectURL: () => "blob:falsy-click",
      revokeObjectURL() {},
      document: {
        createElement: () => ({ click() { throw primary; }, remove() {} }),
        body: { append() {} },
      },
    }));

    assert.equal(outcome.threw, true);
    assert.equal(outcome.reason, primary);
  }
});

test("downloadBlob aggregates a falsy click failure and still attempts every cleanup", () => {
  const events = [];
  const outcome = captureThrow(() => downloadBlob(new Blob(["x"]), "x.svg", {
    createObjectURL: () => "blob:falsy-download-cleanup",
    revokeObjectURL() {
      events.push("revoke");
      throw new Error("falsy download revoke failed");
    },
    document: {
      createElement: () => ({
        click() {
          events.push("click");
          throw 0;
        },
        remove() {
          events.push("remove");
          throw new Error("falsy download remove failed");
        },
      }),
      body: { append() { events.push("append"); } },
    },
  }));

  assert.equal(outcome.threw, true);
  assert.ok(outcome.reason instanceof AggregateError);
  assert.equal(outcome.reason.message, "0");
  assert.equal(outcome.reason.cause, 0);
  assert.equal(outcome.reason.errors[0], 0);
  assert.equal(outcome.reason.errors[1].message, "falsy download remove failed");
  assert.equal(outcome.reason.errors[2].message, "falsy download revoke failed");
  assert.deepEqual(events, ["append", "click", "remove", "revoke"]);
});

test("downloadBlob accepts documentApi and prefers it over the legacy document alias", () => {
  const events = [];
  const link = { click() { events.push("click"); }, remove() { events.push("remove"); } };
  downloadBlob(new Blob(["x"]), "x.svg", {
    documentApi: {
      createElement: () => link,
      body: { append() { events.push("append"); } },
    },
    get document() { throw new Error("legacy document accessed"); },
    createObjectURL: () => "blob:document-api",
    revokeObjectURL() { events.push("revoke"); },
  });
  assert.deepEqual(events, ["append", "click", "remove", "revoke"]);
});

test("downloadDiagramSvg downloads standalone XML with a safe SVG filename", async () => {
  let captured;
  downloadDiagramSvg({ ...exportDiagram, title: "Unsafe / title" }, {
    downloadBlob(blob, filename, dependencies) { captured = { blob, filename, dependencies }; },
  });

  assert.equal(captured.filename, "Unsafe-title.svg");
  assert.equal(captured.blob.type, "image/svg+xml;charset=utf-8");
  assert.equal(captured.dependencies.downloadBlob instanceof Function, true);
  const xml = await captured.blob.text();
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><svg'));
  assert.match(xml, /<title[^>]*>Unsafe \/ title<\/title>/);
});

test("downloadDiagramPng rasterizes full prepared document metrics and downloads once", async () => {
  const png = new Blob(["png"], { type: "image/png" });
  const calls = [];
  const dependencies = {
    async rasterizeSvg(svg, metrics, passedDependencies) {
      calls.push({ kind: "rasterize", svg, metrics, passedDependencies });
      return png;
    },
    downloadBlob(blob, filename, passedDependencies) {
      calls.push({ kind: "download", blob, filename, passedDependencies });
    },
  };
  await downloadDiagramPng({
    kind: "flowchart",
    title: "Coordinate / PNG",
    nodes: [
      { id: "start", label: "Start", type: "terminal" },
      { id: "finish", label: "Finish", type: "process" },
    ],
    edges: [{ from: "start", to: "finish" }],
    legend: [{ type: "process", label: "Full legend" }],
  }, dependencies);

  assert.equal(calls.length, 2);
  const [raster, download] = calls;
  assert.equal(raster.kind, "rasterize");
  assert.equal(raster.passedDependencies, dependencies);
  assert.ok(raster.metrics.titleBand > 0);
  assert.ok(raster.metrics.legendHeight > 0);
  assert.equal(raster.metrics.height, raster.metrics.legendY + raster.metrics.legendHeight);
  assert.match(raster.svg, new RegExp(`<svg[^>]+width="${raster.metrics.width}"[^>]+height="${raster.metrics.height}"`));
  assert.match(raster.svg, />Full legend<\/text>/);
  assert.deepEqual(download, {
    kind: "download",
    blob: png,
    filename: "Coordinate-PNG.png",
    passedDependencies: dependencies,
  });
});

test("downloadDiagramPng serializes the prepared diagram without calling the public preparer again", async () => {
  const source = await readFile(new URL("../src/diagram/export.js", import.meta.url), "utf8");
  const body = source.match(/export async function downloadDiagramPng[\s\S]*?\n}/)?.[0];

  assert.ok(body);
  assert.match(body, /const prepared = prepareDiagram\(diagram\)/);
  assert.match(body, /renderPreparedDiagramSvg\(prepared\)/);
  assert.doesNotMatch(body, /renderDiagramSvg\(prepared\)/);
});

test("the export module imports in Node without document or Image globals", async () => {
  assert.equal(typeof globalThis.document, "undefined");
  assert.equal(typeof globalThis.Image, "undefined");
  const exports = await import(`../src/diagram/export.js?node-safe=${Date.now()}`);
  assert.equal(typeof exports.rasterizeSvg, "function");
  assert.equal(typeof exports.downloadBlob, "function");
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

test("renderDiagramSvg keeps prepared ordinary edge geometry inside its standalone viewBox", () => {
  const topLabelSvg = renderDiagramSvg({
    kind: "flowchart",
    title: "Top short edge export",
    width: 400,
    height: 100,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 0, y: 10, width: 180, height: 48 },
      { id: "right", label: "Right", type: "process", x: 200, y: 10, width: 180, height: 48 },
    ],
    edges: [{ from: "left", to: "right", label: "event" }],
  });
  const outwardSvg = renderDiagramSvg({
    kind: "flowchart",
    title: "Outward anchor export",
    width: 400,
    height: 100,
    nodes: [
      { id: "left", label: "Left", type: "process", x: 0, y: 10, width: 180, height: 48 },
      { id: "right", label: "Right", type: "process", x: 200, y: 10, width: 180, height: 48 },
    ],
    edges: [{
      from: "left",
      to: "right",
      label: "outward",
      fromAnchor: "left",
      toAnchor: "right",
    }],
  });

  assert.match(topLabelSvg, /<svg[^>]+width="400"[^>]+viewBox="0 0 400 [^"]+"/);
  assert.match(topLabelSvg, /<rect x="[^-][^"]*" y="0" width="[^-][^"]*" height="18" rx="5"/);
  assert.match(outwardSvg, /<svg[^>]+width="400"[^>]+viewBox="0 0 400 [^"]+"/);
  assert.match(outwardSvg, /M 0 34 C 0 34 400 34 380 34/);
  assert.doesNotMatch(outwardSvg, /M 0 34 C -/);
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

test("renderDiagramSvg rejects mixed or malformed numeric color grammars", () => {
  for (const value of [
    "rgb(1. 2 3)",
    "rgb(1.e2 2 3)",
    "rgb(10%,20,30%)",
    "rgba(10%,20,30%,.5)",
    "rgba(1 2 3 4)",
    "rgb(1, 2 3)",
    "rgb(1,2,3 / .5)",
    "hsl(120deg 50 40%)",
    "hwb(120 10 20%)",
    "lab(50%,0,0)",
    "oklab(.5,.1,.2)",
  ]) {
    assert.throws(
      () => renderDiagramSvg({
        ...exportDiagram,
        nodes: [{ ...exportDiagram.nodes[0], style: { fill: value } }, exportDiagram.nodes[1]],
      }),
      /standalone SVG paint[\s\S]*nodes\[0\]\.style\.fill/i,
      value,
    );
  }
});

test("renderDiagramSvg accepts strict legacy and modern numeric color grammars", () => {
  const colors = [
    "rgb(1, 2, 3)",
    "rgba(1, 2, 3, 50%)",
    "rgb(10%, 20%, 30%)",
    "rgba(10%, 20%, 30%, 50%)",
    "hsl(120deg, 50%, 40%)",
    "hsla(.5turn, 50%, 40%, .75)",
    "rgb(10 20% 30 / 40%)",
    "rgba(10 20 30 / .5)",
    "HsL(120deg 50% 40% / .5)",
    "hsla(120 50% 40% / 50%)",
    "hwb(120 10% 20% / 30%)",
    "lab(50% 0 .2 / 1)",
    "oklab(.5 .1 .2 / 50%)",
    "lch(50% 20 120deg / .5)",
    "oklch(.5 .2 .25turn / 50%)",
  ];

  for (const color of colors) {
    const svg = renderDiagramSvg({
      ...exportDiagram,
      nodes: [{ ...exportDiagram.nodes[0], style: { fill: color } }, exportDiagram.nodes[1]],
    });
    assert.ok(svg.includes(`fill="${color}"`), color);
  }
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
