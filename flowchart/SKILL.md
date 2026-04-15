---
name: flowchart
description: 用 Claude 的方式画流程图、画图、绘制流程、系统图、决策树、时序图、状态机。触发词包括：画流程图、画图、帮我画、流程图、决策树、时序图、状态图、ER图、泳道图、flowchart、diagram、draw a diagram、show me how this works、visualize this process。对任何要求可视化流程、步骤、关系、状态、决策的请求，都应使用此技能。即使用户只说"画一下XX的流程"也应触发。
---

# Flowchart Skill — Claude Visual Style

生成 **React JSX artifact**，用纯 SVG 实现 Claude 风格流程图：清爽色板、圆角节点、贝塞尔曲线连线、响应式移动端适配。

---

## Step 1 — 判断图类型，选择渲染策略

| 用户说的 | 图类型 | 参考模板 |
|---|---|---|
| 流程图、步骤、how it works | **Flowchart** | `references/flowchart.md` |
| 决策树、if/else、判断 | **Decision Tree** | `references/flowchart.md`（菱形节点） |
| 时序图、交互顺序、API调用 | **Sequence** | `references/sequence.md` |
| 状态机、状态转移 | **State** | `references/flowchart.md`（椭圆节点） |
| 组织架构、层级 | **Hierarchy** | `references/flowchart.md`（树形布局） |
| 泳道、跨部门流程 | **Swimlane** | `references/swimlane.md` |

如果不确定，默认用 **Flowchart**，不需要问用户。

---

## Step 2 — 提取内容

从用户描述中提取：
1. **节点列表** — 每个步骤/状态/判断点
2. **连线列表** — 节点之间的有向关系，以及连线上的标签（如"是/否"）
3. **布局方向** — 默认 top-to-bottom；有明显"并行"结构时用 left-to-right
4. **节点类型** — 开始/结束（椭圆）、过程（圆角矩形）、判断（菱形）、数据（平行四边形）、子流程（双边框矩形）

如果用户描述模糊，直接生成合理的默认内容，不问澄清问题。

---

## Step 3 — Claude 视觉规范

### 节点色板

| 节点类型 | Fill | Stroke | Text |
|---|---|---|---|
| 开始 / 终止 | `#0F172A` | `#0F172A` | `#FFFFFF` |
| 普通流程 | `#F8FAFC` | `#CBD5E1` | `#1E293B` |
| 判断/决策 | `#FEF9C3` | `#CA8A04` | `#713F12` |
| 数据输入/输出 | `#EFF6FF` | `#93C5FD` | `#1E40AF` |
| 子流程 | `#F0FDF4` | `#86EFAC` | `#14532D` |
| 强调/高亮 | `#6366F1` | `#4F46E5` | `#FFFFFF` |
| 错误/异常 | `#FEF2F2` | `#FCA5A5` | `#991B1B` |

**原则**：节点整体用浅色填充，暗色文字；开始/结束节点深色背景白字，形成锚点感。

### 节点形状

```
普通流程   — 圆角矩形 rx=10
判断节点   — 菱形 (path: M cx,y L x+w,cy L cx,y+h L x,cy Z)
开始/结束  — 药丸形 rx=h/2 (全圆角矩形)
数据节点   — 平行四边形 (path 偏移 8px)
子流程     — 双边框矩形 (外层 rx=10 + 内层偏移 4px)
```

### 连线规范

- 用 SVG 贝塞尔曲线 `C` 命令，而非折线
- 连线颜色：`#94A3B8`，strokeWidth 1.5
- 连线标签（如"是/否"）：小字 10px，pill 背景 `#F1F5F9`，轻微阴影
- 箭头：SVG marker，实心三角，填充 `#94A3B8`

### 排版

```
节点标签:  font-size 13px, font-weight 600, system-ui
副标签:    font-size 10px, opacity 0.6
连线标签:  font-size 10px, font-style italic
```

### 阴影与深度

每个节点使用 `filter: drop-shadow(0 1px 3px rgba(15,23,42,0.08))` —— 轻盈而不俗气。

---

## Step 4 — 布局计算规则

**自动布局（top-to-bottom）**：

```
节点尺寸默认：160 × 48（过程节点）/ 140 × 48（判断节点）
层间距（垂直）：80px
同层节点间距（水平）：40px
画布 padding：60px 四周
画布宽度：max(600, 节点数 × 90)
画布高度：层数 × (节点高 + 层间距) + padding × 2
```

判断节点有两个出口（是/否），左右分叉布局：
- "是" → 直接向下
- "否" → 右侧弯曲绕过再向下，或右移一列

---

## Step 5 — React JSX 代码结构

```jsx
import { useState } from "react";

// ── 图数据（节点 + 连线）────────────────────────────────────────
const NODES = [
  { id: "start",   label: "开始",     type: "terminal", x: 300, y: 60  },
  { id: "step1",   label: "第一步",   type: "process",  x: 300, y: 180 },
  { id: "decide",  label: "条件判断", type: "decision", x: 300, y: 300 },
  { id: "step2a",  label: "路径A",    type: "process",  x: 160, y: 420 },
  { id: "step2b",  label: "路径B",    type: "process",  x: 440, y: 420 },
  { id: "end",     label: "结束",     type: "terminal", x: 300, y: 540 },
];

const EDGES = [
  { from: "start",  to: "step1"  },
  { from: "step1",  to: "decide" },
  { from: "decide", to: "step2a", label: "是" },
  { from: "decide", to: "step2b", label: "否" },
  { from: "step2a", to: "end"    },
  { from: "step2b", to: "end"    },
];

const W = 700, H = 640;   // 根据内容调整

// ── 颜色 ──────────────────────────────────────────────────────────
const STYLE = {
  terminal: { fill: "#0F172A", stroke: "#0F172A", text: "#FFFFFF" },
  process:  { fill: "#F8FAFC", stroke: "#CBD5E1", text: "#1E293B" },
  decision: { fill: "#FEF9C3", stroke: "#CA8A04", text: "#713F12" },
  data:     { fill: "#EFF6FF", stroke: "#93C5FD", text: "#1E40AF" },
  sub:      { fill: "#F0FDF4", stroke: "#86EFAC", text: "#14532D" },
  highlight:{ fill: "#6366F1", stroke: "#4F46E5", text: "#FFFFFF" },
  error:    { fill: "#FEF2F2", stroke: "#FCA5A5", text: "#991B1B" },
};

// ── 节点尺寸 ──────────────────────────────────────────────────────
const SIZE = {
  terminal: { w: 140, h: 44 },
  process:  { w: 160, h: 48 },
  decision: { w: 140, h: 80 },   // 菱形需要高度
  data:     { w: 150, h: 48 },
  sub:      { w: 160, h: 48 },
  highlight:{ w: 160, h: 48 },
  error:    { w: 160, h: 48 },
};

// ── Anchor Point ──────────────────────────────────────────────────
function anchor(node, side) {
  const { w, h } = SIZE[node.type] || SIZE.process;
  const cx = node.x + w / 2, cy = node.y + h / 2;
  if (node.type === "decision") {
    if (side === "top")    return [cx, node.y];
    if (side === "bottom") return [cx, node.y + h];
    if (side === "left")   return [node.x, cy];
    if (side === "right")  return [node.x + w, cy];
  }
  if (side === "top")    return [cx, node.y];
  if (side === "bottom") return [cx, node.y + h];
  if (side === "left")   return [node.x, cy];
  if (side === "right")  return [node.x + w, cy];
  return [cx, cy];
}

// ── 贝塞尔曲线路径 ────────────────────────────────────────────────
function bezierPath(n1, n2) {
  const [x1, y1] = anchor(n1, "bottom");
  const [x2, y2] = anchor(n2, "top");
  const dy = Math.abs(y2 - y1);
  const bend = Math.max(dy * 0.4, 30);
  return `M${x1},${y1} C${x1},${y1+bend} ${x2},${y2-bend} ${x2},${y2}`;
}

// ── 节点形状渲染 ──────────────────────────────────────────────────
function NodeShape({ node, isH, isS }) {
  const s = STYLE[node.type] || STYLE.process;
  const { w, h } = SIZE[node.type] || SIZE.process;
  const cx = node.x + w / 2, cy = node.y + h / 2;
  const T = "fill 0.2s ease, stroke 0.2s ease, stroke-width 0.15s ease";
  const sw = isS ? 2.5 : isH ? 2 : 1.5;

  if (node.type === "terminal") {
    return <rect x={node.x} y={node.y} width={w} height={h} rx={h/2}
      style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />;
  }
  if (node.type === "decision") {
    const d = `M${cx},${node.y} L${node.x+w},${cy} L${cx},${node.y+h} L${node.x},${cy} Z`;
    return <path d={d}
      style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />;
  }
  if (node.type === "data") {
    const sk = 8;
    const d = `M${node.x+sk},${node.y} L${node.x+w},${node.y} L${node.x+w-sk},${node.y+h} L${node.x},${node.y+h} Z`;
    return <path d={d}
      style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />;
  }
  if (node.type === "sub") {
    return <>
      <rect x={node.x} y={node.y} width={w} height={h} rx={10}
        style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />
      <rect x={node.x+6} y={node.y} width={w-12} height={h} rx={8}
        fill="none"
        style={{ stroke: s.stroke, strokeWidth: 1, transition: T }} />
    </>;
  }
  // default: process / highlight / error
  return <rect x={node.x} y={node.y} width={w} height={h} rx={10}
    style={{ fill: isS ? s.stroke : s.fill,
             fillOpacity: isS ? 0.15 : 1,
             stroke: isS ? s.stroke : isH ? s.stroke : s.stroke,
             strokeWidth: sw, transition: T }} />;
}

// ── Node ────────────────────────────────────────────────────────────
function Node({ node, hovered, selected, onHover, onSelect }) {
  const s = STYLE[node.type] || STYLE.process;
  const { w, h } = SIZE[node.type] || SIZE.process;
  const cx = node.x + w / 2;
  const cy = node.type === "decision" ? node.y + h / 2 : node.y + h / 2;
  const isH = hovered  === node.id;
  const isS = selected === node.id;

  return (
    <g
      style={{
        cursor: "pointer",
        transformOrigin: `${cx}px ${cy}px`,
        transform: isS ? "scale(1.04)" : "scale(1)",
        transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        filter: isS
          ? `drop-shadow(0 4px 12px ${s.stroke}66)`
          : isH
          ? `drop-shadow(0 3px 8px ${s.stroke}44)`
          : "drop-shadow(0 1px 3px rgba(15,23,42,0.08))",
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(node.id)}
    >
      <NodeShape node={node} isH={isH} isS={isS} />

      {/* 选中环 */}
      {isS && node.type !== "decision" && (
        <rect x={node.x-4} y={node.y-4} width={w+8} height={h+8} rx={14}
          fill="none" stroke={s.stroke} strokeWidth={1.5}
          strokeDasharray="5 3" opacity={0.5}>
          <animate attributeName="stroke-dashoffset"
            from="0" to="-32" dur="1.2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* 节点标签 */}
      <text x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={13} fontWeight={600} fill={s.text}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none" }}>
        {node.label}
      </text>
      {node.sub && (
        <text x={cx} y={cy + 16}
          textAnchor="middle" dominantBaseline="central"
          fontSize={10} fill={s.text} opacity={0.55}
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ pointerEvents: "none" }}>
          {node.sub}
        </text>
      )}
    </g>
  );
}

// ── Edge ─────────────────────────────────────────────────────────────
function Edge({ edge, nodeMap, selected }) {
  const fn = nodeMap[edge.from], tn = nodeMap[edge.to];
  if (!fn || !tn) return null;
  const isActive = selected === edge.from || selected === edge.to;

  // 连线方向：尽量 bottom→top，同行则 right→left
  const [x1, y1] = anchor(fn,
    fn.y < tn.y ? "bottom"
    : fn.y > tn.y ? "top"
    : fn.x < tn.x ? "right" : "left");
  const [x2, y2] = anchor(tn,
    fn.y < tn.y ? "top"
    : fn.y > tn.y ? "bottom"
    : fn.x < tn.x ? "left" : "right");

  const dy = Math.abs(y2 - y1), dx = Math.abs(x2 - x1);
  const isHoriz = dy < 20;
  const bend = isHoriz ? dx * 0.4 : Math.max(dy * 0.4, 24);

  const c1x = isHoriz ? x1 + (x2>x1?bend:-bend) : x1;
  const c1y = isHoriz ? y1 : y1 + bend;
  const c2x = isHoriz ? x2 - (x2>x1?bend:-bend) : x2;
  const c2y = isHoriz ? y2 : y2 - bend;

  const d = `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;
  const mx = (x1+x2)/2, my = (y1+y2)/2 - 8;

  const strokeColor = isActive ? "#6366F1" : "#94A3B8";
  const strokeW     = isActive ? 2 : 1.5;

  return (
    <g style={{ transition: "opacity 0.2s" }}
       opacity={selected && !isActive ? 0.2 : 1}>
      <path d={d} fill="none"
        stroke={strokeColor} strokeWidth={strokeW}
        markerEnd={isActive ? "url(#arr-active)" : "url(#arr)"}
        style={{ transition: "stroke 0.2s, stroke-width 0.15s" }} />

      {edge.label && (
        <>
          <rect x={mx-18} y={my-9} width={36} height={18} rx={5}
            fill="#F1F5F9" opacity={0.95}
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.06))" }} />
          <text x={mx} y={my+1}
            textAnchor="middle" dominantBaseline="central"
            fontSize={10} fill={isActive ? "#4F46E5" : "#64748B"}
            fontStyle="italic"
            fontFamily="system-ui, sans-serif">
            {edge.label}
          </text>
        </>
      )}
    </g>
  );
}

// ── Main ──────────────────────────────────────────────────────────────
export default function Flowchart() {
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  function handleSelect(id) {
    setSelected(prev => prev === id ? null : id);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{
          margin: 0,
          fontSize: "clamp(16px, 3vw, 22px)",
          fontWeight: 800,
          color: "#0F172A",
          letterSpacing: "-0.02em",
        }}>
          {/* 图表标题 */}
          流程图标题
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
          {/* 副标题/说明 */}
        </p>
      </div>

      {/* SVG 画布 */}
      <div style={{
        background: "#FFFFFF",
        borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08)",
        width: "100%",
        maxWidth: W + 32,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%" height="auto"
          style={{ display: "block", minWidth: 400 }}
        >
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="6"
              refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#94A3B8" />
            </marker>
            <marker id="arr-active" markerWidth="8" markerHeight="6"
              refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#6366F1" />
            </marker>
          </defs>

          <rect width={W} height={H} fill="#FFFFFF" />

          {/* 连线（在节点下方渲染） */}
          {EDGES.map((e, i) => (
            <Edge key={i} edge={e} nodeMap={nodeMap} selected={selected} />
          ))}

          {/* 节点 */}
          {NODES.map(n => (
            <Node key={n.id} node={n}
              hovered={hovered} selected={selected}
              onHover={setHovered} onSelect={handleSelect} />
          ))}
        </svg>
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: "#CBD5E1" }}>
        点击节点高亮关联路径 · 移动端可横向滑动
      </p>
    </div>
  );
}
```

---

## Step 6 — 内容填充规则

生成时将上方模板中的注释部分替换为实际内容：

1. `NODES` 数组 → 根据用户描述填入真实节点，坐标按布局规则计算
2. `EDGES` 数组 → 根据流程关系填入，决策节点分支加 `label`
3. `W / H` → 根据节点数量计算合理画布尺寸
4. 标题和副标题 → 填入图表名称

**坐标计算参考**：
- 节点层数 × 128px = 画布高度基础
- 每层最多 4 个节点并排，总宽 = 节点数 × 200px
- 每层节点横向居中排列

---

## Step 7 — 质量检查

输出前确认：
- [ ] 无节点坐标重叠（间距 ≥ 20px）
- [ ] 所有 `edge.from` / `edge.to` 对应有效节点 ID
- [ ] 决策节点有且仅有两条出边，分别带 "是"/"否" 标签
- [ ] 开始节点和结束节点各只有一个
- [ ] `W × H` 足够容纳所有节点（节点不超出 padding 范围）
- [ ] 移动端最小宽度 `minWidth: 400`
