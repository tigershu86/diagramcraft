import React, { useState } from "react";

import {
  ARCH_ECOMMERCE,
  ARCH_FLOWCHART_STYLE,
  LOGIN_FLOW,
} from "../examples/diagrams.js";
import { DiagramRenderer } from "./diagram/DiagramRenderer.js";

const h = React.createElement;

export const EXAMPLE_OPTIONS = [
  { id: "architecture", label: "Architecture", detail: "22 nodes", diagram: ARCH_ECOMMERCE },
  { id: "hybrid", label: "Hybrid style", detail: "22 nodes", diagram: ARCH_FLOWCHART_STYLE },
  { id: "flowchart", label: "Login flow", detail: "10 nodes", diagram: LOGIN_FLOW },
];

export function tabIdForKey(activeId, key) {
  const index = EXAMPLE_OPTIONS.findIndex((option) => option.id === activeId);
  if (index < 0) return null;
  if (key === "Home") return EXAMPLE_OPTIONS[0].id;
  if (key === "End") return EXAMPLE_OPTIONS.at(-1).id;
  if (key === "ArrowLeft") return EXAMPLE_OPTIONS[(index - 1 + EXAMPLE_OPTIONS.length) % EXAMPLE_OPTIONS.length].id;
  if (key === "ArrowRight") return EXAMPLE_OPTIONS[(index + 1) % EXAMPLE_OPTIONS.length].id;
  return null;
}

function ProductHeader() {
  return h("header", { className: "product-header" }, [
    h("div", { className: "brand-lockup", key: "brand" }, [
      h("div", { className: "brand-mark", "aria-hidden": true, key: "mark" }, [
        h("span", { key: "one" }),
        h("span", { key: "two" }),
        h("span", { key: "three" }),
      ]),
      h("div", { key: "copy" }, [
        h("h1", { key: "title" }, "Diagramcraft"),
        h("p", { key: "subtitle" }, "Shared schema · geometry · React SVG renderer"),
      ]),
    ]),
    h("div", { className: "repo-facts", key: "facts", "aria-label": "Repository capabilities" }, [
      h("span", { key: "schema", "aria-label": "1 Shared schema" }, [h("strong", { key: "value" }, "1"), "Shared schema"]),
      h("span", { key: "skills", "aria-label": "2 skills" }, [h("strong", { key: "value" }, "2"), "skills"]),
      h("span", { key: "examples", "aria-label": "3 examples" }, [h("strong", { key: "value" }, "3"), "examples"]),
    ]),
  ]);
}

function ExampleTabs({ activeId, onChange }) {
  return h("div", { className: "example-tabs", role: "tablist", "aria-label": "Diagram examples" },
    EXAMPLE_OPTIONS.map((option) => {
      const selected = option.id === activeId;
      return h("button", {
        key: option.id,
        id: `tab-${option.id}`,
        type: "button",
        role: "tab",
        "aria-selected": selected,
        "aria-controls": `panel-${option.id}`,
        tabIndex: selected ? 0 : -1,
        onClick: () => onChange(option.id),
        onKeyDown: (event) => {
          const nextId = tabIdForKey(activeId, event.key);
          if (!nextId) return;
          event.preventDefault();
          onChange(nextId);
          event.currentTarget.parentElement?.querySelector(`#tab-${nextId}`)?.focus();
        },
      }, [
        h("span", { key: "label" }, option.label),
        h("small", { key: "detail" }, option.detail),
      ]);
    }));
}

export default function App() {
  const [activeId, setActiveId] = useState(EXAMPLE_OPTIONS[0].id);
  const active = EXAMPLE_OPTIONS.find((option) => option.id === activeId) || EXAMPLE_OPTIONS[0];

  return h("main", { className: "app-shell" }, [
    h(ProductHeader, { key: "header" }),
    h("section", { className: "preview-workspace", "aria-label": "Diagram preview", key: "workspace" }, [
      h("div", { className: "workspace-toolbar", key: "toolbar" }, [
        h("div", { key: "intro" }, [
          h("h2", { key: "title" }, "Renderer preview"),
          h("p", { key: "description" }, "Switch datasets; rendering behavior stays shared."),
        ]),
        h(ExampleTabs, { key: "tabs", activeId, onChange: setActiveId }),
      ]),
      h("div", {
        className: "preview-panel",
        id: `panel-${active.id}`,
        role: "tabpanel",
        "aria-labelledby": `tab-${active.id}`,
        key: active.id,
      }, h(DiagramRenderer, { diagram: active.diagram })),
    ]),
    h("footer", { className: "app-footer", key: "footer" },
      "Select a node with mouse, keyboard, or touch to trace its connections."),
  ]);
}
