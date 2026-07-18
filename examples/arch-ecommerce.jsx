import React from "react";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { ARCH_ECOMMERCE } from "./diagrams.js";

export { ARCH_ECOMMERCE as diagram };
export default function ArchEcommerce() {
  return React.createElement(DiagramRenderer, { diagram: ARCH_ECOMMERCE });
}
