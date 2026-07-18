import React from "react";

import { edgeLabelPosition, routeEdge } from "./geometry.js";
import { FONT, TOKENS, nodeStyle } from "./theme.js";

const h = React.createElement;

export function svgIdPrefix(value) {
  const encoded = [...String(value)]
    .map((character) => character.codePointAt(0).toString(16))
    .join("-");
  return `svg-${encoded || "0"}`;
}

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

function DiagramNode({ node, hovered, selected, onHover, onSelect, interactive, clipId }) {
  const style = nodeStyle(node);
  const active = hovered || selected;
  const centerX = node.x + node.width / 2;
  const centerY = node.y + node.height / 2;
  const textY = centerY - (node.sublabel ? 8 : 0) + (node.shape === "database" ? 5 : 0);
  const activate = () => onSelect(node.id);
  const groupProps = interactive ? {
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
  } : {};

  return h("g", groupProps, [
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
      style: interactive ? { pointerEvents: "none", userSelect: "none" } : undefined,
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
      style: interactive ? { pointerEvents: "none", userSelect: "none" } : undefined,
    }, node.sublabel) : null,
  ]);
}

function DiagramEdge({
  edge,
  fromNode,
  toNode,
  selected,
  interactive,
  markerId,
  selectedMarkerId,
  width,
  height,
}) {
  const bounds = { width, height };
  const route = routeEdge(fromNode, toNode, edge, bounds);
  const connected = selected === edge.from || selected === edge.to;
  const dimmed = Boolean(selected && !connected);
  const fromStyle = nodeStyle(fromNode);
  const stroke = connected ? fromStyle.accent : edge.dashed ? TOKENS.edgeMuted : TOKENS.edge;
  const label = edgeLabelPosition(route, edge, fromNode, toNode, bounds);

  return h("g", {
    opacity: dimmed ? 0.16 : 1,
    style: interactive ? { transition: "opacity 180ms ease" } : undefined,
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
        x: label.left,
        y: label.top,
        width: label.width,
        height: label.height,
        rx: 5,
        fill: TOKENS.edgeLabelFill,
        opacity: 0.97,
      }),
      h("text", {
        key: "text",
        x: label.x,
        y: label.y + 1,
        textLength: label.textLength,
        lengthAdjust: "spacingAndGlyphs",
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

function DiagramTier({ tier, diagram }) {
  return h("g", null, [
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
  ]);
}

export function DiagramScene({
  diagram,
  selected = null,
  hovered = null,
  onHover = () => {},
  onSelect = () => {},
  interactive = false,
  idPrefix = "diagram",
}) {
  const safePrefix = svgIdPrefix(idPrefix);
  const markerId = `${safePrefix}-arrow`;
  const activeMarkerId = `${safePrefix}-arrow-active`;
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const selectedId = nodeMap.has(selected) ? selected : null;

  return [
    h("defs", { key: "defs" }, [
      h("marker", { id: markerId, key: "default", markerWidth: 8, markerHeight: 6, refX: 7, refY: 3, orient: "auto" },
        h("path", { d: "M0,0 L8,3 L0,6 Z", fill: TOKENS.edge })),
    ]),
    h("rect", { key: "canvas", width: diagram.width, height: diagram.height, fill: TOKENS.canvas }),
    ...diagram.tiers.map((tier) => h(DiagramTier, {
      key: tier.id || tier.label,
      tier,
      diagram,
    })),
    ...diagram.edges.map((edge, index) => h(DiagramEdge, {
      key: `${edge.id || `${edge.from}-${edge.to}`}-${index}`,
      edge,
      fromNode: nodeMap.get(edge.from),
      toNode: nodeMap.get(edge.to),
      selected: selectedId,
      interactive,
      markerId,
      selectedMarkerId: `${activeMarkerId}-${index}`,
      width: diagram.width,
      height: diagram.height,
    })),
    ...diagram.nodes.map((node, index) => h(DiagramNode, {
      key: node.id,
      node,
      hovered: hovered === node.id,
      selected: selectedId === node.id,
      onHover,
      onSelect,
      interactive,
      clipId: `${safePrefix}-clip-${index}`,
    })),
  ];
}

export default DiagramScene;
