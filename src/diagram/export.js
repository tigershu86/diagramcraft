import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagramDocument, documentMetrics } from "./DiagramDocument.js";
import { prepareDiagram } from "./layout/index.js";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const MAX_CANVAS_DIMENSION = 32_767;
const MAX_CANVAS_PIXELS = 16_777_216;
const FILENAME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });
const FILENAME_ENCODER = new TextEncoder();
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;

function xmlCodePointAllowed(codePoint) {
  return codePoint === 0x09
    || codePoint === 0x0A
    || codePoint === 0x0D
    || (codePoint >= 0x20 && codePoint <= 0xD7FF)
    || (codePoint >= 0xE000 && codePoint <= 0xFFFD)
    || (codePoint >= 0x10000 && codePoint <= 0x10FFFF);
}

function validateXmlString(value, path) {
  for (let index = 0; index < value.length; index += 1) {
    const codePoint = value.codePointAt(index);
    if (!xmlCodePointAllowed(codePoint)) {
      const formatted = codePoint.toString(16).toUpperCase().padStart(4, "0");
      throw new TypeError(`Invalid XML 1.0 character U+${formatted} at ${path}`);
    }
    if (codePoint > 0xFFFF) index += 1;
  }
}

function validateXmlStrings(value, path = "$", seen = new WeakSet()) {
  if (typeof value === "string") {
    validateXmlString(value, path);
    return;
  }
  if (!value || typeof value !== "object" || seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateXmlStrings(entry, `${path}[${index}]`, seen));
    return;
  }
  Object.entries(value).forEach(([key, entry]) => {
    validateXmlStrings(entry, path === "$" ? key : `${path}.${key}`, seen);
  });
}

function renderPreparedDiagramSvg(diagram) {
  validateXmlStrings(diagram);
  return XML_DECLARATION + renderToStaticMarkup(React.createElement(DiagramDocument, {
    diagram,
    idPrefix: "export",
  }));
}

export function renderDiagramSvg(input) {
  return renderPreparedDiagramSvg(prepareDiagram(input));
}

export function safeDiagramFilename(title, extension) {
  if (typeof extension !== "string" || !/^(?:svg|png)$/i.test(extension)) {
    throw new TypeError("Invalid filename extension: expected svg or png");
  }
  if (typeof title !== "string") {
    throw new TypeError("Invalid filename title: expected a string");
  }
  const normalizedExtension = extension.toLowerCase();
  const suffix = `.${normalizedExtension}`;
  let stem = title
    .normalize("NFC")
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.\s-]+|[.\s-]+$/gu, "") || "diagram";
  if (WINDOWS_DEVICE.test(stem)) stem = `_${stem}`;

  const byteLimit = 255 - FILENAME_ENCODER.encode(suffix).length;
  const unitLimit = 255 - suffix.length;
  let truncated = "";
  let byteLength = 0;
  for (const { segment } of FILENAME_SEGMENTER.segment(stem)) {
    const segmentBytes = FILENAME_ENCODER.encode(segment).length;
    if (byteLength + segmentBytes > byteLimit || truncated.length + segment.length > unitLimit) break;
    truncated += segment;
    byteLength += segmentBytes;
  }
  truncated = truncated.replace(/[.\s-]+$/gu, "") || "diagram";
  if (WINDOWS_DEVICE.test(truncated)) truncated = `_${truncated}`;
  return `${truncated}${suffix}`;
}

function objectUrlDependencies(dependencies) {
  const hasDirectCreate = dependencies.createObjectURL !== undefined;
  const hasDirectRevoke = dependencies.revokeObjectURL !== undefined;
  if (hasDirectCreate !== hasDirectRevoke) {
    throw new TypeError("createObjectURL and revokeObjectURL must be provided together");
  }
  if (hasDirectCreate) {
    if (typeof dependencies.createObjectURL !== "function"
      || typeof dependencies.revokeObjectURL !== "function") {
      throw new TypeError("createObjectURL and revokeObjectURL must be functions");
    }
    return {
      createObjectURL: dependencies.createObjectURL,
      revokeObjectURL: dependencies.revokeObjectURL,
    };
  }

  const urlApi = dependencies.urlApi ?? globalThis.URL;
  if (!urlApi || typeof urlApi.createObjectURL !== "function"
    || typeof urlApi.revokeObjectURL !== "function") {
    throw new TypeError("URL API requires createObjectURL and revokeObjectURL functions");
  }
  return {
    createObjectURL: urlApi.createObjectURL.bind(urlApi),
    revokeObjectURL: urlApi.revokeObjectURL.bind(urlApi),
  };
}

function assertRasterInput(svg, dimensions) {
  if (typeof svg !== "string" || svg.trim().length === 0) {
    throw new TypeError("Invalid SVG for PNG export: expected a non-empty string");
  }
  if (!dimensions || typeof dimensions !== "object") {
    throw new TypeError("Invalid PNG export dimensions: expected width and height");
  }
  for (const name of ["width", "height"]) {
    if (!Number.isFinite(dimensions[name]) || dimensions[name] <= 0) {
      throw new TypeError(`Invalid PNG export ${name}: expected a positive finite number`);
    }
  }
}

function rasterPixelDimensions(dimensions) {
  const width = Math.round(dimensions.width * 2);
  const height = Math.round(dimensions.height * 2);
  if (!Number.isSafeInteger(width) || width <= 0
    || !Number.isSafeInteger(height) || height <= 0) {
    throw new TypeError("Unable to allocate PNG canvas: scaled dimensions must be finite positive safe integers");
  }
  if (width > MAX_CANVAS_DIMENSION || height > MAX_CANVAS_DIMENSION) {
    throw new RangeError(`Unable to allocate PNG canvas: maximum dimension is ${MAX_CANVAS_DIMENSION} pixels`);
  }
  if (height > MAX_CANVAS_PIXELS / width) {
    throw new RangeError(`Unable to allocate PNG canvas: maximum area is ${MAX_CANVAS_PIXELS} pixels`);
  }
  return { width, height };
}

function throwOperationFailures(hasPrimary, primary, cleanupErrors) {
  if (!hasPrimary && cleanupErrors.length === 0) return;
  if (hasPrimary && cleanupErrors.length === 0) throw primary;
  if (!hasPrimary && cleanupErrors.length === 1) throw cleanupErrors[0];
  const cause = hasPrimary ? primary : cleanupErrors[0];
  const errors = hasPrimary ? [primary, ...cleanupErrors] : cleanupErrors;
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new AggregateError(errors, message, { cause });
}

function decodeImage(image, source) {
  return new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error("Unable to decode the SVG for PNG export"));
    try {
      image.src = source;
    } catch (error) {
      reject(error);
    }
  }).finally(() => {
    image.onload = null;
    image.onerror = null;
  });
}

function encodePng(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Unable to encode the PNG export"));
      }, "image/png");
    } catch (error) {
      reject(new Error("Unable to encode the PNG export", { cause: error }));
    }
  });
}

export async function rasterizeSvg(svg, dimensions, dependencies = {}) {
  assertRasterInput(svg, dimensions);
  const { width, height } = rasterPixelDimensions(dimensions);
  const { createObjectURL, revokeObjectURL } = objectUrlDependencies(dependencies);
  const createCanvas = dependencies.createCanvas
    ?? (() => globalThis.document.createElement("canvas"));
  const createImage = dependencies.createImage
    ?? (() => new globalThis.Image());
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  if (canvas.width !== width || canvas.height !== height) {
    throw new Error(`Unable to allocate ${width}x${height} PNG canvas`);
  }
  const context = canvas.getContext("2d");
  if (!context) throw new Error("PNG export requires a 2D canvas context");

  const source = createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  let result;
  let hasPrimary = false;
  let primary;
  try {
    const image = createImage();
    await decodeImage(image, source);
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    result = await encodePng(canvas);
  } catch (error) {
    hasPrimary = true;
    primary = error;
  }
  const cleanupErrors = [];
  try {
    revokeObjectURL(source);
  } catch (error) {
    cleanupErrors.push(error);
  }
  throwOperationFailures(hasPrimary, primary, cleanupErrors);
  return result;
}

export function downloadBlob(blob, filename, dependencies = {}) {
  const { createObjectURL, revokeObjectURL } = objectUrlDependencies(dependencies);
  const documentApi = dependencies.documentApi ?? dependencies.document ?? globalThis.document;
  const source = createObjectURL(blob);
  let link;
  let hasPrimary = false;
  let primary;
  try {
    link = documentApi.createElement("a");
    link.href = source;
    link.download = filename;
    documentApi.body.append(link);
    link.click();
  } catch (error) {
    hasPrimary = true;
    primary = error;
  }
  const cleanupErrors = [];
  try {
    link?.remove();
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    revokeObjectURL(source);
  } catch (error) {
    cleanupErrors.push(error);
  }
  throwOperationFailures(hasPrimary, primary, cleanupErrors);
}

export function downloadDiagramSvg(diagram, dependencies = {}) {
  const svg = renderDiagramSvg(diagram);
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const download = dependencies.downloadBlob ?? downloadBlob;
  return download(blob, safeDiagramFilename(diagram.title, "svg"), dependencies);
}

export async function downloadDiagramPng(diagram, dependencies = {}) {
  const prepared = prepareDiagram(diagram);
  const svg = renderPreparedDiagramSvg(prepared);
  const metrics = documentMetrics(prepared);
  const rasterize = dependencies.rasterizeSvg ?? rasterizeSvg;
  const download = dependencies.downloadBlob ?? downloadBlob;
  const blob = await rasterize(svg, metrics, dependencies);
  return download(blob, safeDiagramFilename(prepared.title, "png"), dependencies);
}
