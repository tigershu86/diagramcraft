export const DIAGRAM_KINDS = Object.freeze(["architecture", "flowchart"]);
export const ANCHORS = Object.freeze(["top", "right", "bottom", "left"]);
export const NODE_SHAPES = Object.freeze(["rect", "terminal", "decision", "data", "subprocess", "database", "dashed-rect"]);
export const NODE_TYPES = Object.freeze([
  "client", "cdn", "lb", "security", "gateway", "service", "cache", "database", "queue", "search", "external",
  "terminal", "process", "decision", "data", "sub", "state", "highlight", "error",
]);
export const DIAGRAM_FIELDS = Object.freeze([
  "kind", "title", "subtitle", "width", "height", "nodeDefaults", "tiers", "nodes", "edges", "legend",
]);
export const NODE_DEFAULT_FIELDS = Object.freeze(["width", "height", "shape", "sublabel"]);
export const TIER_FIELDS = Object.freeze(["id", "label", "x", "y", "width", "height", "color"]);
export const NODE_FIELDS = Object.freeze([
  "id", "label", "type", "x", "y", "tier", "width", "height", "fontSize", "shape", "sublabel", "style",
]);
export const EDGE_FIELDS = Object.freeze(["id", "from", "to", "label", "dashed", "fromAnchor", "toAnchor"]);
export const LEGEND_OBJECT_FIELDS = Object.freeze(["type", "label"]);

export const NODE_PRESETS = Object.freeze({
  terminal: Object.freeze({ width: 140, height: 44, shape: "terminal" }),
  process: Object.freeze({ width: 180, height: 48, shape: "rect" }),
  decision: Object.freeze({ width: 150, height: 76, shape: "decision" }),
  data: Object.freeze({ width: 180, height: 48, shape: "data" }),
  sub: Object.freeze({ width: 180, height: 48, shape: "subprocess" }),
  state: Object.freeze({ width: 180, height: 48, shape: "rect" }),
  highlight: Object.freeze({ width: 180, height: 48, shape: "rect" }),
  error: Object.freeze({ width: 160, height: 48, shape: "rect" }),
  database: Object.freeze({ width: 152, height: 72, shape: "database" }),
  external: Object.freeze({ width: 152, height: 60, shape: "dashed-rect" }),
});

export const DEFAULT_NODE = Object.freeze({ width: 152, height: 60, shape: "rect" });

function owns(node, key) {
  return Object.prototype.hasOwnProperty.call(node, key);
}

export function hasOwnPosition(node) {
  return Boolean(node) && owns(node, "x") && owns(node, "y");
}

export function hasPartialPosition(node) {
  return Boolean(node) && owns(node, "x") !== owns(node, "y");
}
