import React from "react";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { ARCH_FLOWCHART_STYLE } from "./diagrams.js";

export { ARCH_FLOWCHART_STYLE as diagram };
export default function ArchFlowchartStyle() {
  return React.createElement(DiagramRenderer, { diagram: ARCH_FLOWCHART_STYLE });
}
