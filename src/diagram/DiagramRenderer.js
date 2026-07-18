import React, { useId, useMemo, useState } from "react";

import { routeEdge } from "./geometry.js";
import { normalizeDiagram } from "./schema.js";
import { NODE_STYLES, TOKENS, nodeStyle } from "./theme.js";

const h = React.createElement;
const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

function shapeElements(node, style, active, selected, clipId) {
  const { x, y, width, height, shape } = node;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const stroke = active ? style.accent : style.stroke;
  const strokeWidth = selected ? 2.4 : active ? 1.9 : 1.2;
  const fill = selected && !["gateway", "highlight", "terminal"].includes(node.type)
    ? style.accent
    : style.fill;
  const fillOpacity = selected && !["gateway", "highlight", "terminal"].includes(node.type) ? 0.13 : 1;
  const common = { fill, fillOpacity, stroke, strokeWidth };

  if (shape === "terminal") {
    return [h("rect", { key: "shape", x, y, width, height, rx: height / 2, ...common })];
  }
  if (shape === "decision") {
    const d = `M ${centerX} ${y} L ${x + width} ${centerY} L ${centerX} ${y + height} L ${x} ${centerY} Z`;
    return [h("path", { key: "shape", d, ...common })];
  }
  if (shape === "data") {
    const skew = 10;
    const d = `M ${x + skew} ${y} L ${x + width} ${y} L ${x + width - skew} ${y + height} L ${x} ${y + height} Z`;
    return [h("path", { key: "shape", d, ...common })];
  }
  if (shape === "database") {
    return [
      h("rect", { key: "body", x, y: y + 12, width, height: height - 12, rx: 5, ...common }),
      h("ellipse", { key: "bottom", cx: centerX, cy: y + height, rx: width / 2, ry: 9, ...common }),
      h("ellipse", { key: "cap", cx: centerX, cy: y + 12, rx: width / 2, ry: 9, ...common }),
    ];
  }

  const elements = [h("rect", {
    key: "shape",
    x,
    y,
    width,
    height,
    rx: TOKENS.radius,
    ...common,
    strokeDasharray: shape === "dashed-rect" ? "6 3" : undefined,
  })];
  if (shape === "subprocess") {
    elements.push(h("rect", {
      key: "inner",
      x: x + 6,
      y,
      width: width - 12,
      height,
      rx: 7,
      fill: "none",
      stroke,
      strokeWidth: 1,
      opacity: 0.72,
    }));
  } else if (!["gateway", "highlight"].includes(node.type)) {
    elements.push(h("rect", {
      key: "bar",
      x,
      y,
      width,
      height: 6,
      fill: style.accent,
      fillOpacity: active ? 0.62 : 0.28,
      clipPath: `url(#${clipId})`,
    }));
  }
  return elements;
}

function DiagramNode({ node, hovered, selected, onHover, onSelect, idPrefix }) {
  const style = nodeStyle(node);
  const active = hovered || selected;
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const clipId = `${idPrefix}-clip-${node.id}`;
  const textY = centerY - (node.sublabel ? 8 : 0) + (node.shape === "database" ? 5 : 0);
  const activate = () => onSelect(node.id);

  return h("g", {
    role: "button",
    tabIndex: 0,
    "aria-label": node.label,
    "aria-pressed": selected,
    onMouseEnter: () => onHover(node.id),
    onMouseLeave: () => onHover(null),
    onFocus: () => onHover(node.id),
    onBlur: () => onHover(null),
    onClick: activate,
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activate();
      }
    },
    style: {
      cursor: "pointer",
      outline: "none",
      transformOrigin: `${centerX}px ${centerY}px`,
      transform: selected ? "scale(1.045)" : "scale(1)",
      transition: "transform 180ms ease, filter 180ms ease",
      filter: active
        ? `drop-shadow(0 4px 12px ${style.accent}45)`
        : "drop-shadow(0 1px 3px rgba(15,23,42,0.08))",
    },
  }, [
    h("defs", { key: "defs" }, h("clipPath", { id: clipId }, h("rect", {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rx: TOKENS.radius,
    }))),
    ...shapeElements(node, style, active, selected, clipId),
    selected && node.shape !== "decision" ? h("rect", {
      key: "selection",
      x: node.x - 5,
      y: node.y - 5,
      width: node.width + 10,
      height: node.height + 10,
      rx: 15,
      fill: "none",
      stroke: style.accent,
      strokeWidth: 1.5,
      strokeDasharray: "5 3",
      opacity: 0.52,
    }) : null,
    h("text", {
      key: "label",
      x: centerX,
      y: textY,
      textAnchor: "middle",
      dominantBaseline: "central",
      fontSize: node.fontSize || 12.5,
      fontWeight: 700,
      fill: style.text,
      fontFamily: FONT,
      style: { pointerEvents: "none", userSelect: "none" },
    }, node.label),
    node.sublabel ? h("text", {
      key: "sublabel",
      x: centerX,
      y: textY + 18,
      textAnchor: "middle",
      dominantBaseline: "central",
      fontSize: 9.5,
      fill: style.text,
      opacity: 0.58,
      fontFamily: FONT,
      style: { pointerEvents: "none", userSelect: "none" },
    }, node.sublabel) : null,
  ]);
}

function DiagramEdge({ edge, fromNode, toNode, selected, markerId, activeMarkerId }) {
  const route = routeEdge(fromNode, toNode, edge);
  const connected = selected === edge.from || selected === edge.to;
  const dimmed = Boolean(selected && !connected);
  const fromStyle = nodeStyle(fromNode);
  const stroke = connected ? fromStyle.accent : edge.dashed ? TOKENS.edgeMuted : TOKENS.edge;
  const markerSuffix = `${edge.from}-${edge.to}`.replace(/[^A-Za-z0-9_-]/g, "-");
  const selectedMarkerId = `${activeMarkerId}-${markerSuffix}`;
  let [labelX, labelY] = route.labelPoint;
  const shortHorizontal = ["left", "right"].includes(route.fromAnchor)
    && ["left", "right"].includes(route.toAnchor)
    && Math.abs(route.points.end[0] - route.points.start[0]) < 80
    && Math.abs(route.points.end[1] - route.points.start[1]) < 2;
  if (shortHorizontal) labelY = Math.min(fromNode.y, toNode.y) - 10;
  const labelWidth = edge.label ? Math.max(36, edge.label.length * 6.2 + 14) : 0;

  return h("g", {
    opacity: dimmed ? 0.16 : 1,
    style: { transition: "opacity 180ms ease" },
  }, [
    connected ? h("defs", { key: "marker" }, h("marker", {
      id: selectedMarkerId,
      markerWidth: 8,
      markerHeight: 6,
      refX: 7,
      refY: 3,
      orient: "auto",
    }, h("path", { d: "M0,0 L8,3 L0,6 Z", fill: stroke }))) : null,
    h("path", {
      key: "path",
      d: route.d,
      fill: "none",
      stroke,
      strokeWidth: connected ? 2.2 : edge.dashed ? 1.2 : 1.5,
      strokeDasharray: edge.dashed ? "5 3" : undefined,
      markerEnd: `url(#${connected ? selectedMarkerId : markerId})`,
    }),
    edge.label ? h("g", { key: "label" }, [
      h("rect", {
        key: "pill",
        x: labelX - labelWidth / 2,
        y: labelY - 9,
        width: labelWidth,
        height: 18,
        rx: 5,
        fill: TOKENS.edgeLabelFill,
        opacity: 0.97,
      }),
      h("text", {
        key: "text",
        x: labelX,
        y: labelY + 1,
        textAnchor: "middle",
        dominantBaseline: "central",
        fontSize: 10,
        fontStyle: connected ? "normal" : "italic",
        fontWeight: connected ? 600 : 400,
        fill: connected ? fromStyle.accent : TOKENS.edgeLabel,
        fontFamily: FONT,
      }, edge.label),
    ]) : null,
  ]);
}

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
  const diagram = useMemo(() => normalizeDiagram(input), [input]);
  const [hovered, setHovered] = useState(null);
  const [selected, setSelected] = useState(initialSelectedId);
  const reactId = useId().replace(/:/g, "");
  const titleId = `${reactId}-title`;
  const descriptionId = `${reactId}-description`;
  const markerId = `${reactId}-arrow`;
  const activeMarkerId = `${reactId}-arrow-active`;
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const selectedId = nodeMap.has(selected) ? selected : null;
  const inferredLegend = [...new Set(diagram.nodes.map((node) => node.type))];
  const legend = diagram.legend.length ? diagram.legend : inferredLegend;
  const defaultMinWidth = Math.min(diagram.width, diagram.kind === "architecture" ? 560 : 520);

  const svgChildren = [
    h("title", { id: titleId, key: "title" }, diagram.title),
    h("desc", { id: descriptionId, key: "description" }, diagram.subtitle || `${diagram.title} diagram`),
    h("defs", { key: "defs" }, [
      h("marker", { id: markerId, key: "default", markerWidth: 8, markerHeight: 6, refX: 7, refY: 3, orient: "auto" },
        h("path", { d: "M0,0 L8,3 L0,6 Z", fill: TOKENS.edge })),
    ]),
    h("rect", { key: "canvas", width: diagram.width, height: diagram.height, fill: TOKENS.canvas }),
    ...diagram.tiers.map((tier) => h("g", { key: tier.id || tier.label }, [
      h("rect", {
        key: "background",
        x: tier.x ?? 12,
        y: tier.y,
        width: tier.width ?? diagram.width - 24,
        height: tier.height,
        rx: 8,
        fill: tier.color || TOKENS.panel,
        stroke: TOKENS.border,
      }),
      h("text", {
        key: "label",
        x: (tier.x ?? 12) + 12,
        y: tier.y + 16,
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 1.8,
        fill: TOKENS.edge,
        fontFamily: FONT,
      }, tier.label),
    ])),
    ...diagram.edges.map((edge, index) => h(DiagramEdge, {
      key: edge.id || `${edge.from}-${edge.to}-${index}`,
      edge,
      fromNode: nodeMap.get(edge.from),
      toNode: nodeMap.get(edge.to),
      selected: selectedId,
      markerId,
      activeMarkerId,
    })),
    ...diagram.nodes.map((node) => h(DiagramNode, {
      key: node.id,
      node,
      hovered: hovered === node.id,
      selected: selectedId === node.id,
      onHover: setHovered,
      onSelect: (id) => setSelected((current) => current === id ? null : id),
      idPrefix: reactId,
    })),
  ];

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
    }, svgChildren)),
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
