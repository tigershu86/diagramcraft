import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagramDocument } from "./DiagramDocument.js";
import { prepareDiagram } from "./layout/index.js";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
const FILENAME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });
const FILENAME_ENCODER = new TextEncoder();
const WINDOWS_DEVICE = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NUMBER_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?%?$/i;
const ANGLE_TOKEN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?(?:deg|grad|rad|turn)?$/i;
const NUMERIC_COLOR_FUNCTIONS = new Set([
  "rgb", "rgba", "hsl", "hsla", "hwb", "lab", "lch", "oklab", "oklch",
]);
const NAMED_COLORS = new Set((
  "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown "
  + "burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan "
  + "darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid "
  + "darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet "
  + "deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro "
  + "ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki "
  + "lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray "
  + "lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey "
  + "lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid "
  + "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue "
  + "mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod "
  + "palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple "
  + "red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue "
  + "slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat "
  + "white whitesmoke yellow yellowgreen currentcolor none"
).split(" "));

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

function numericComponents(value) {
  const trimmed = value.trim();
  if (!trimmed || /^,|,$|,\s*,/.test(trimmed)) return null;
  return trimmed.replace(/,/g, " ").trim().split(/\s+/);
}

function validNumericColor(value) {
  const match = value.match(/^([a-z]+)\(([\s\S]*)\)$/i);
  if (!match) return false;
  const name = match[1].toLowerCase();
  if (!NUMERIC_COLOR_FUNCTIONS.has(name)) return false;
  const sections = match[2].split("/");
  if (sections.length > 2) return false;
  const components = numericComponents(sections[0]);
  let alpha = sections.length === 2 ? numericComponents(sections[1]) : null;
  if (!components || (sections.length === 2 && (!alpha || alpha.length !== 1))) return false;

  if (sections.length === 1 && ["rgba", "hsla"].includes(name) && components.length === 4) {
    alpha = components.splice(3, 1);
  }
  if (components.length !== 3 || (alpha && !NUMBER_TOKEN.test(alpha[0]))) return false;

  const hueIndex = ["hsl", "hsla", "hwb"].includes(name)
    ? 0
    : ["lch", "oklch"].includes(name) ? 2 : -1;
  return components.every((component, index) => (
    index === hueIndex ? ANGLE_TOKEN.test(component) : NUMBER_TOKEN.test(component)
  ));
}

function standalonePaint(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (HEX_COLOR.test(trimmed)) return true;
  if (/^[a-z]+$/i.test(trimmed) && NAMED_COLORS.has(trimmed.toLowerCase())) return true;
  return validNumericColor(trimmed);
}

function assertStandalonePaint(value, path) {
  if (!standalonePaint(value)) {
    throw new TypeError(`Invalid standalone SVG paint at ${path}: expected hex, named, or numeric color`);
  }
}

function validateSelfContainedPaint(diagram) {
  diagram.nodes.forEach((node, index) => {
    for (const field of ["fill", "stroke", "accent", "text"]) {
      if (node.style && Object.hasOwn(node.style, field)) {
        assertStandalonePaint(node.style[field], `nodes[${index}].style.${field}`);
      }
    }
  });
  diagram.tiers.forEach((tier, index) => {
    if (Object.hasOwn(tier, "color")) assertStandalonePaint(tier.color, `tiers[${index}].color`);
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
