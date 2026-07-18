import React from "react";
import { DiagramRenderer } from "../src/diagram/DiagramRenderer.js";
import { LOGIN_FLOW } from "./diagrams.js";

export { LOGIN_FLOW as diagram };
export default function FlowchartLogin() {
  return React.createElement(DiagramRenderer, { diagram: LOGIN_FLOW });
}
