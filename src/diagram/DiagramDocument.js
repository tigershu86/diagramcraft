import React from "react";

import { DiagramScene } from "./DiagramScene.js";
import { FONT, NODE_STYLES, TOKENS } from "./theme.js";

const h = React.createElement;

export function resolvedLegend(diagram) {
  if (diagram.legend?.length) return diagram.legend;
  return [...new Set(diagram.nodes.map((node) => node.type))];
}

export function documentMetrics(diagram) {
  const titleBand = diagram.subtitle ? 76 : 58;
  const columns = Math.max(1, Math.floor((diagram.width - 48) / 160));
  const rows = Math.ceil(resolvedLegend(diagram).length / columns);
  const legendHeight = rows > 0 ? rows * 34 + 20 : 0;
  const sceneY = titleBand;
  const legendY = sceneY + diagram.height;
  return {
    width: diagram.width,
    height: legendY + legendHeight,
    titleBand,
    sceneY,
    legendY,
    legendHeight,
    columns,
    rows,
  };
}

function DiagramLegend({ diagram, metrics, items }) {
  if (!items.length) return null;
  const columnWidth = (metrics.width - 48) / metrics.columns;

  return h("g", { transform: `translate(0 ${metrics.legendY})` }, items.map((item, index) => {
    const type = typeof item === "string" ? item : item.type;
    const label = typeof item === "string" ? item : item.label;
    const style = NODE_STYLES[type] || NODE_STYLES.process;
    const column = index % metrics.columns;
    const row = Math.floor(index / metrics.columns);
    const x = 24 + column * columnWidth;
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
      }, label),
    ]);
  }));
}

export function DiagramDocument({ diagram }) {
  const metrics = documentMetrics(diagram);
  const legend = resolvedLegend(diagram);

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
    h("text", {
      key: "heading",
      x: metrics.width / 2,
      y: 30,
      textAnchor: "middle",
      fontSize: 22,
      fontWeight: 700,
      fill: TOKENS.heading,
      fontFamily: FONT,
    }, diagram.title),
    diagram.subtitle ? h("text", {
      key: "subtitle",
      x: metrics.width / 2,
      y: 52,
      textAnchor: "middle",
      fontSize: 12,
      fill: TOKENS.muted,
      fontFamily: FONT,
    }, diagram.subtitle) : null,
    h("g", { key: "scene", transform: `translate(0 ${metrics.sceneY})` }, h(DiagramScene, {
      diagram,
      interactive: false,
      idPrefix: "export",
    })),
    h(DiagramLegend, { key: "legend", diagram, metrics, items: legend }),
  ]);
}

export default DiagramDocument;
