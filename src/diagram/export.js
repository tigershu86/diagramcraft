import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagramDocument } from "./DiagramDocument.js";
import { prepareDiagram } from "./layout/index.js";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const EXTERNAL_PAINT = /(^|[^\w-])(?:url|var)\s*\(/i;
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

function validateSelfContainedPaint(diagram) {
  diagram.nodes.forEach((node, index) => {
    for (const field of ["fill", "stroke", "accent", "text"]) {
      const value = node.style?.[field];
      if (typeof value === "string" && EXTERNAL_PAINT.test(value)) {
        throw new TypeError(`Unsafe external paint reference at nodes[${index}].style.${field}`);
      }
    }
  });
  diagram.tiers.forEach((tier, index) => {
    if (typeof tier.color === "string" && EXTERNAL_PAINT.test(tier.color)) {
      throw new TypeError(`Unsafe external paint reference at tiers[${index}].color`);
    }
  });
}

export function renderDiagramSvg(input) {
  const diagram = prepareDiagram(input);
  validateXmlStrings(diagram);
  validateSelfContainedPaint(diagram);
  return XML_DECLARATION + renderToStaticMarkup(React.createElement(DiagramDocument, {
    diagram,
    idPrefix: "export",
  }));
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
