import React, { useEffect, useRef, useState } from "react";

import {
  ARCH_ECOMMERCE,
  ARCH_FLOWCHART_STYLE,
  LOGIN_FLOW,
} from "../examples/diagrams.js";
import { DiagramRenderer } from "./diagram/DiagramRenderer.js";
import { downloadDiagramPng, downloadDiagramSvg } from "./diagram/export.js";
import { layoutDiagram } from "./diagram/layout/index.js";

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

export function setExampleOverride(overrides, id, diagram) {
  const next = { ...overrides };
  if (diagram) next[id] = diagram;
  else delete next[id];
  return next;
}

export function formatActionError(error) {
  if (error instanceof Error) return error.message || "未知错误";
  if (error === null || error === undefined || error === "") return "未知错误";
  return String(error);
}

export function isCurrentActionRequest(currentToken, requestToken, mounted) {
  return mounted && currentToken === requestToken;
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
  const [overrides, setOverrides] = useState({});
  const [status, setStatus] = useState("");
  const [pngBusy, setPngBusy] = useState(false);
  const actionRequestRef = useRef(0);
  const mountedRef = useRef(true);
  const active = EXAMPLE_OPTIONS.find((option) => option.id === activeId) || EXAMPLE_OPTIONS[0];
  const hasOverride = Boolean(overrides[active.id]);
  const visibleDiagram = overrides[active.id] || active.diagram;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      actionRequestRef.current += 1;
    };
  }, []);

  const invalidatePngRequest = () => {
    actionRequestRef.current += 1;
    setPngBusy(false);
  };

  const selectExample = (id) => {
    invalidatePngRequest();
    setStatus("");
    setActiveId(id);
  };

  const toggleLayout = () => {
    invalidatePngRequest();
    if (hasOverride) {
      setOverrides((current) => setExampleOverride(current, active.id, null));
      setStatus("已恢复原布局");
      return;
    }

    try {
      const diagram = layoutDiagram(active.diagram, { mode: "force" });
      setOverrides((current) => setExampleOverride(current, active.id, diagram));
      setStatus("已完成自动重排");
    } catch (error) {
      setStatus(`自动重排失败：${formatActionError(error)}`);
    }
  };

  const exportSvg = () => {
    invalidatePngRequest();
    try {
      downloadDiagramSvg(visibleDiagram);
      setStatus("SVG 已导出");
    } catch (error) {
      setStatus(`SVG 导出失败：${formatActionError(error)}`);
    }
  };

  const exportPng = async () => {
    const requestToken = actionRequestRef.current + 1;
    actionRequestRef.current = requestToken;
    setPngBusy(true);
    setStatus("PNG 正在导出…");
    try {
      await downloadDiagramPng(visibleDiagram);
      if (isCurrentActionRequest(actionRequestRef.current, requestToken, mountedRef.current)) {
        setStatus("PNG 已导出");
      }
    } catch (error) {
      if (isCurrentActionRequest(actionRequestRef.current, requestToken, mountedRef.current)) {
        setStatus(`PNG 导出失败：${formatActionError(error)}`);
      }
    } finally {
      if (isCurrentActionRequest(actionRequestRef.current, requestToken, mountedRef.current)) {
        setPngBusy(false);
      }
    }
  };

  return h("main", { className: "app-shell" }, [
    h(ProductHeader, { key: "header" }),
    h("section", { className: "preview-workspace", "aria-label": "Diagram preview", key: "workspace" }, [
      h("div", { className: "workspace-toolbar", key: "toolbar" }, [
        h("div", { key: "intro" }, [
          h("h2", { key: "title" }, "Renderer preview"),
          h("p", { key: "description" }, "Switch datasets; rendering behavior stays shared."),
        ]),
        h("div", { className: "toolbar-controls", key: "controls" }, [
          h(ExampleTabs, { key: "tabs", activeId, onChange: selectExample }),
          h("div", {
            className: "diagram-actions",
            role: "group",
            "aria-label": "Diagram actions",
            key: "actions",
          }, [
            h("button", { type: "button", onClick: toggleLayout, key: "layout" },
              hasOverride ? "恢复原布局" : "自动重排"),
            h("button", { type: "button", onClick: exportSvg, key: "svg" }, "导出 SVG"),
            h("button", {
              type: "button",
              onClick: exportPng,
              disabled: pngBusy,
              key: "png",
            }, "导出 PNG"),
          ]),
          h("p", {
            className: "action-status",
            role: "status",
            "aria-live": "polite",
            key: "status",
          }, status),
        ]),
      ]),
      h("div", {
        className: "preview-panel",
        id: `panel-${active.id}`,
        role: "tabpanel",
        "aria-labelledby": `tab-${active.id}`,
        key: active.id,
      }, h(DiagramRenderer, { diagram: visibleDiagram })),
    ]),
    h("footer", { className: "app-footer", key: "footer" },
      "Select a node with mouse, keyboard, or touch to trace its connections."),
  ]);
}
