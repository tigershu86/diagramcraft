import {
  ANCHORS,
  DIAGRAM_KINDS,
  NODE_DEFAULT_FIELDS,
  NODE_SHAPES,
  NODE_TYPES,
} from "../src/diagram/contract.js";

const nonEmptyString = { type: "string", minLength: 1 };
const finiteNumber = { type: "number" };
const positiveNumber = { type: "number", exclusiveMinimum: 0 };

function nodeDefaultProperties() {
  const supported = {
    width: positiveNumber,
    height: positiveNumber,
    shape: { enum: NODE_SHAPES },
    sublabel: { type: "string" },
  };

  return Object.fromEntries(NODE_DEFAULT_FIELDS.map((field) => [field, supported[field]]));
}

export function buildDiagramSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://diagramcraft.dev/schema/diagram.schema.json",
    title: "Diagramcraft Diagram",
    type: "object",
    additionalProperties: false,
    required: ["kind", "title", "nodes", "edges"],
    properties: {
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
    },
    $defs: {
      style: {
        type: "object",
        additionalProperties: true,
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
        properties: {
          id: nonEmptyString,
          label: { type: "string" },
          x: finiteNumber,
          y: finiteNumber,
          width: positiveNumber,
          height: positiveNumber,
          color: { type: "string" },
        },
      },
      node: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "type"],
        dependentRequired: { x: ["y"], y: ["x"] },
        properties: {
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
        },
      },
      edge: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          id: { type: "string" },
          from: nonEmptyString,
          to: nonEmptyString,
          label: { type: "string" },
          dashed: { type: "boolean" },
          fromAnchor: { enum: ANCHORS },
          toAnchor: { enum: ANCHORS },
        },
      },
      legendItem: {
        oneOf: [
          { enum: NODE_TYPES },
          {
            type: "object",
            additionalProperties: false,
            required: ["type", "label"],
            properties: {
              type: { enum: NODE_TYPES },
              label: { type: "string" },
            },
          },
        ],
      },
    },
  };
}
