import React, { useId } from "react";

import { DiagramScene, svgIdPrefix } from "./DiagramScene.js";
import { FONT, NODE_STYLES, TOKENS } from "./theme.js";

const h = React.createElement;
const GRAPHEME_SEGMENTER = new Intl.Segmenter("en", { granularity: "grapheme" });

function constrainedTextLength(value, fontSize, maximum) {
  const graphemes = [...GRAPHEME_SEGMENTER.segment(value)].length;
  const estimated = Math.max(1, Math.round(graphemes * fontSize * 0.62 * 10) / 10);
  return Math.min(maximum, estimated);
}

export function resolvedLegend(diagram) {
  if (diagram.legend?.length) return diagram.legend;
  return [...new Set(diagram.nodes.map((node) => node.type))];
}

export function documentMetrics(diagram) {
  const titleBand = diagram.subtitle ? 76 : 58;
  const width = Math.max(diagram.width, 160);
  const columns = Math.max(1, Math.floor((width - 48) / 160));
  const rows = Math.ceil(resolvedLegend(diagram).length / columns);
  const legendHeight = rows > 0 ? rows * 34 + 20 : 0;
  const sceneY = titleBand;
  const sceneX = (width - diagram.width) / 2;
  const legendY = sceneY + diagram.height;
  const columnWidth = (width - 48) / columns;
  return {
    width,
    height: legendY + legendHeight,
    titleBand,
    sceneY,
    sceneX,
    legendY,
    legendHeight,
    columns,
    rows,
    columnWidth,
    titleTextWidth: width - 48,
    subtitleTextWidth: width - 48,
    legendTextWidth: columnWidth - 18,
  };
}

function DiagramLegend({ diagram, metrics, items }) {
  if (!items.length) return null;
  return h("g", { transform: `translate(0 ${metrics.legendY})` }, items.map((item, index) => {
    const type = typeof item === "string" ? item : item.type;
    const label = typeof item === "string" ? item : item.label;
    const style = NODE_STYLES[type] || NODE_STYLES.process;
    const column = index % metrics.columns;
    const row = Math.floor(index / metrics.columns);
    const x = 24 + column * metrics.columnWidth;
    const y = 17 + row * 34;
    return h("g", { key: `${type}-${index}` }, [
      h("circle", { key: "dot", cx: x + 5, cy: y, r: 5, fill: style.accent }),
      h("text", {
        key: "label",
        x: x + 18,
        y,
        dominantBaseline: "central",
        fontSize: 12,
        fontWeight: 500,
        fill: TOKENS.muted,
        fontFamily: FONT,
        textLength: constrainedTextLength(label, 12, metrics.legendTextWidth),
        lengthAdjust: "spacingAndGlyphs",
      }, label),
    ]);
  }));
}

export function DiagramDocument({ diagram, idPrefix }) {
  const metrics = documentMetrics(diagram);
  const legend = resolvedLegend(diagram);
  const generatedId = useId();
  const documentPrefix = idPrefix ?? generatedId;
  const safePrefix = svgIdPrefix(documentPrefix);
  const titleId = `${safePrefix}-title`;
  const descriptionId = `${safePrefix}-description`;

  return h("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: metrics.width,
    height: metrics.height,
    viewBox: `0 0 ${metrics.width} ${metrics.height}`,
    role: "img",
    "aria-labelledby": `${titleId} ${descriptionId}`,
  }, [
    h("title", { id: titleId, key: "title" }, diagram.title),
    h("desc", { id: descriptionId, key: "description" }, diagram.subtitle || `${diagram.title} diagram`),
    h("rect", { key: "background", width: metrics.width, height: metrics.height, fill: TOKENS.canvas }),
    h("text", {
      key: "heading",
      x: metrics.width / 2,
      y: 30,
      textAnchor: "middle",
      fontSize: 22,
      fontWeight: 700,
      fill: TOKENS.heading,
      fontFamily: FONT,
      textLength: constrainedTextLength(diagram.title, 22, metrics.titleTextWidth),
      lengthAdjust: "spacingAndGlyphs",
    }, diagram.title),
    diagram.subtitle ? h("text", {
      key: "subtitle",
      x: metrics.width / 2,
      y: 52,
      textAnchor: "middle",
      fontSize: 12,
      fill: TOKENS.muted,
      fontFamily: FONT,
      textLength: constrainedTextLength(diagram.subtitle, 12, metrics.subtitleTextWidth),
      lengthAdjust: "spacingAndGlyphs",
    }, diagram.subtitle) : null,
    h("g", { key: "scene", transform: `translate(${metrics.sceneX} ${metrics.sceneY})` }, h(DiagramScene, {
      diagram,
      interactive: false,
      idPrefix: documentPrefix,
    })),
    h(DiagramLegend, { key: "legend", diagram, metrics, items: legend }),
  ]);
}

export default DiagramDocument;
