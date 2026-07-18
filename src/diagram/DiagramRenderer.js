import React, { useId, useMemo, useState } from "react";

import { DiagramScene } from "./DiagramScene.js";
import { prepareDiagram } from "./layout/index.js";
import { FONT, NODE_STYLES, TOKENS } from "./theme.js";

const h = React.createElement;

function Legend({ items }) {
  if (!items.length) return null;
  return h("div", { className: "diagram-legend", style: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: "8px 18px",
    marginTop: 18,
  } }, items.map((item) => {
    const type = typeof item === "string" ? item : item.type;
    const label = typeof item === "string" ? item : item.label;
    const style = NODE_STYLES[type] || NODE_STYLES.process;
    return h("span", { key: type, style: {
      display: "inline-flex",
      alignItems: "center",
      gap: 7,
      color: TOKENS.muted,
      font: `500 12px ${FONT}`,
    } }, [
      h("span", { key: "dot", "aria-hidden": true, style: {
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: style.accent,
      } }),
      label,
    ]);
  }));
}

export function DiagramRenderer({
  diagram: input,
  initialSelectedId = null,
  minWidth,
  showHeader = true,
  showLegend = true,
  showHint = true,
}) {
  const diagram = useMemo(() => prepareDiagram(input), [input]);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(initialSelectedId);
  const reactId = useId().replace(/:/g, "");
  const titleId = `${reactId}-title`;
  const descriptionId = `${reactId}-description`;
  const selectedId = diagram.nodes.some((node) => node.id === selected) ? selected : null;
  const inferredLegend = [...new Set(diagram.nodes.map((node) => node.type))];
  const legend = diagram.legend.length ? diagram.legend : inferredLegend;
  const defaultMinWidth = Math.min(diagram.width, diagram.kind === "architecture" ? 560 : 520);

  return h("section", { className: "diagram-renderer", style: {
    width: "100%",
    color: TOKENS.heading,
    fontFamily: FONT,
  } }, [
    showHeader ? h("header", { key: "header", style: { textAlign: "center", marginBottom: 22 } }, [
      h("h2", { key: "title", style: {
        margin: 0,
        fontSize: "clamp(18px, 3vw, 25px)",
        lineHeight: 1.2,
        letterSpacing: "-0.025em",
      } }, diagram.title),
      diagram.subtitle ? h("p", { key: "subtitle", style: {
        margin: "7px 0 0",
        fontSize: 13,
        color: TOKENS.muted,
      } }, diagram.subtitle) : null,
    ]) : null,
    h("div", { key: "frame", className: "diagram-frame", style: {
      width: "100%",
      maxWidth: diagram.width + 32,
      margin: "0 auto",
      overflowX: "auto",
      background: TOKENS.canvas,
      border: `1px solid ${TOKENS.border}`,
      borderRadius: 16,
      boxShadow: "0 1px 3px rgba(15,23,42,0.06), 0 14px 40px rgba(15,23,42,0.08)",
    } }, h("svg", {
      role: "group",
      "aria-labelledby": `${titleId} ${descriptionId}`,
      viewBox: `0 0 ${diagram.width} ${diagram.height}`,
      width: "100%",
      style: {
        display: "block",
        height: "auto",
        minWidth: minWidth ?? defaultMinWidth,
      },
    }, [
      h("title", { id: titleId, key: "title" }, diagram.title),
      h("desc", { id: descriptionId, key: "description" }, diagram.subtitle || `${diagram.title} diagram`),
      h(DiagramScene, {
        key: "scene",
        diagram,
        selected: selectedId,
        hovered,
        onHover: setHovered,
        onSelect: (id) => setSelected((current) => current === id ? null : id),
        interactive: true,
        idPrefix: reactId,
      }),
    ])),
    showLegend ? h(Legend, { key: "legend", items: legend }) : null,
    showHint ? h("p", { key: "hint", style: {
      margin: "13px 0 0",
      textAlign: "center",
      fontSize: 11,
      color: TOKENS.edge,
    } }, "点击或按 Enter 高亮关联路径 · 移动端可横向滑动") : null,
  ]);
}

export default DiagramRenderer;
