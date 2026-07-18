import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DiagramDocument } from "./DiagramDocument.js";
import { prepareDiagram } from "./layout/index.js";

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';

export function renderDiagramSvg(input) {
  const diagram = prepareDiagram(input);
  return XML_DECLARATION + renderToStaticMarkup(React.createElement(DiagramDocument, { diagram }));
}

export function safeDiagramFilename(title, extension) {
  const stem = title
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "diagram";
  return `${stem}.${extension}`;
}
