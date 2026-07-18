import {
  ANCHORS,
  DIAGRAM_FIELDS,
  DIAGRAM_KINDS,
  EDGE_FIELDS,
  LEGEND_OBJECT_FIELDS,
  NODE_DEFAULT_FIELDS,
  NODE_FIELDS,
  NODE_SHAPES,
  NODE_TYPES,
  TIER_FIELDS,
} from "../src/diagram/contract.js";
import { NODE_STYLE_PAINT_FIELDS, PAINT_JSON_SCHEMA } from "../src/diagram/paint.js";

const nonEmptyString = { type: "string", minLength: 1 };
const finiteNumber = { type: "number" };
const positiveNumber = { type: "number", exclusiveMinimum: 0 };

function closedProperties(fields, definitions, name) {
  const definedFields = Object.keys(definitions);
  const allowedFields = new Set(fields);
  const unexpectedFields = definedFields.filter((field) => !allowedFields.has(field));
  if (unexpectedFields.length > 0) {
    throw new Error(`${name} has schema definitions for unsupported fields: ${unexpectedFields.join(", ")}`);
  }

  return Object.fromEntries(fields.map((field) => {
    if (!Object.hasOwn(definitions, field) || definitions[field] === undefined) {
      throw new Error(`${name} is missing a schema definition for ${field}`);
    }
    return [field, definitions[field]];
  }));
}

function nodeDefaultProperties() {
  return closedProperties(NODE_DEFAULT_FIELDS, {
    width: positiveNumber,
    height: positiveNumber,
    shape: { enum: NODE_SHAPES },
    sublabel: { type: "string" },
  }, "nodeDefaults");
}

export function buildDiagramSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://diagramcraft.dev/schema/diagram.schema.json",
    title: "Diagramcraft Diagram",
    type: "object",
    additionalProperties: false,
    required: ["kind", "title", "nodes", "edges"],
    properties: closedProperties(DIAGRAM_FIELDS, {
      kind: { enum: DIAGRAM_KINDS },
      title: nonEmptyString,
      subtitle: { type: "string" },
      width: positiveNumber,
      height: positiveNumber,
      nodeDefaults: { $ref: "#/$defs/nodeDefaults" },
      tiers: { type: "array", items: { $ref: "#/$defs/tier" } },
      nodes: { type: "array", items: { $ref: "#/$defs/node" } },
      edges: { type: "array", items: { $ref: "#/$defs/edge" } },
      legend: { type: "array", items: { $ref: "#/$defs/legendItem" } },
    }, "diagram"),
    $defs: {
      paint: PAINT_JSON_SCHEMA,
      style: {
        type: "object",
        additionalProperties: false,
        properties: Object.fromEntries(NODE_STYLE_PAINT_FIELDS.map((field) => [field, { $ref: "#/$defs/paint" }])),
      },
      nodeDefaults: {
        type: "object",
        additionalProperties: false,
        properties: nodeDefaultProperties(),
      },
      tier: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: closedProperties(TIER_FIELDS, {
          id: nonEmptyString,
          label: { type: "string" },
          x: finiteNumber,
          y: finiteNumber,
          width: positiveNumber,
          height: positiveNumber,
          color: { $ref: "#/$defs/paint" },
        }, "tier"),
      },
      node: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type"],
        dependentRequired: { x: ["y"], y: ["x"] },
        properties: closedProperties(NODE_FIELDS, {
          id: nonEmptyString,
          label: nonEmptyString,
          type: { enum: NODE_TYPES },
          x: finiteNumber,
          y: finiteNumber,
          tier: nonEmptyString,
          width: positiveNumber,
          height: positiveNumber,
          fontSize: positiveNumber,
          shape: { enum: NODE_SHAPES },
          sublabel: { type: "string" },
          style: { $ref: "#/$defs/style" },
        }, "node"),
      },
      edge: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: closedProperties(EDGE_FIELDS, {
          id: { type: "string" },
          from: nonEmptyString,
          to: nonEmptyString,
          label: { type: "string" },
          dashed: { type: "boolean" },
          fromAnchor: { enum: ANCHORS },
          toAnchor: { enum: ANCHORS },
        }, "edge"),
      },
      legendItem: {
        oneOf: [
          { enum: NODE_TYPES },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "label"],
            properties: closedProperties(LEGEND_OBJECT_FIELDS, {
              type: { enum: NODE_TYPES },
              label: { type: "string" },
            }, "legendItem"),
          },
        ],
      },
    },
  };
}
