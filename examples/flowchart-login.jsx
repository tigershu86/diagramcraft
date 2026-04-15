import { useState } from "react";

const NODES = [
  { id: "start",   label: "开始",         type: "terminal",  x: 280, y: 40  },
  { id: "input",   label: "输入账号密码",  type: "data",      x: 260, y: 140 },
  { id: "valid",   label: "格式校验",      type: "decision",  x: 255, y: 244 },
  { id: "err1",    label: "提示格式错误",  type: "error",     x: 480, y: 264 },
  { id: "auth",    label: "身份认证",      type: "process",   x: 260, y: 384 },
  { id: "check",   label: "认证通过？",    type: "decision",  x: 255, y: 484 },
  { id: "err2",    label: "提示账号错误",  type: "error",     x: 480, y: 504 },
  { id: "token",   label: "生成 Token",   type: "sub",       x: 260, y: 624 },
  { id: "home",    label: "跳转首页",      type: "highlight", x: 260, y: 724 },
  { id: "end",     label: "结束",          type: "terminal",  x: 280, y: 820 },
];

const EDGES = [
  { from: "start",  to: "input"  },
  { from: "input",  to: "valid"  },
  { from: "valid",  to: "auth",  label: "通过" },
  { from: "valid",  to: "err1",  label: "失败" },
  { from: "err1",   to: "input"  },
  { from: "auth",   to: "check"  },
  { from: "check",  to: "token", label: "是"   },
  { from: "check",  to: "err2",  label: "否"   },
  { from: "err2",   to: "input"  },
  { from: "token",  to: "home"   },
  { from: "home",   to: "end"    },
];

const W = 700, H = 900;

const STYLE = {
  terminal:  { fill: "#0F172A", stroke: "#0F172A", text: "#FFFFFF" },
  process:   { fill: "#F8FAFC", stroke: "#CBD5E1", text: "#1E293B" },
  decision:  { fill: "#FEF9C3", stroke: "#CA8A04", text: "#713F12" },
  data:      { fill: "#EFF6FF", stroke: "#93C5FD", text: "#1E40AF" },
  sub:       { fill: "#F0FDF4", stroke: "#86EFAC", text: "#14532D" },
  highlight: { fill: "#6366F1", stroke: "#4F46E5", text: "#FFFFFF" },
  error:     { fill: "#FEF2F2", stroke: "#FCA5A5", text: "#991B1B" },
};

const SIZE = {
  terminal:  { w: 140, h: 44 },
  process:   { w: 180, h: 48 },
  decision:  { w: 150, h: 76 },
  data:      { w: 180, h: 48 },
  sub:       { w: 180, h: 48 },
  highlight: { w: 180, h: 48 },
  error:     { w: 160, h: 48 },
};

function sz(node) { return SIZE[node.type] || SIZE.process; }

function anchor(node, side) {
  const { w, h } = sz(node);
  const cx = node.x + w / 2, cy = node.y + h / 2;
  if (side === "top")    return [cx, node.y];
  if (side === "bottom") return [cx, node.y + h];
  if (side === "left")   return [node.x, cy];
  if (side === "right")  return [node.x + w, cy];
  return [cx, cy];
}

function NodeShape({ node, isH, isS }) {
  const s = STYLE[node.type];
  const { w, h } = sz(node);
  const cx = node.x + w / 2, cy = node.y + h / 2;
  const sw = isS ? 2.5 : isH ? 2 : 1.5;
  const T = "fill 0.2s ease, stroke 0.2s ease, stroke-width 0.15s ease";

  if (node.type === "terminal")
    return <rect x={node.x} y={node.y} width={w} height={h} rx={h/2}
      style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />;

  if (node.type === "decision") {
    const d = `M${cx},${node.y} L${node.x+w},${cy} L${cx},${node.y+h} L${node.x},${cy} Z`;
    return <path d={d}
      style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />;
  }
  if (node.type === "data") {
    const sk = 10;
    const d = `M${node.x+sk},${node.y} L${node.x+w},${node.y} L${node.x+w-sk},${node.y+h} L${node.x},${node.y+h} Z`;
    return <path d={d}
      style={{ fill: isS ? s.stroke : s.fill, fillOpacity: isS ? 0.14 : 1,
               stroke: s.stroke, strokeWidth: sw, transition: T }} />;
  }
  if (node.type === "sub")
    return <>
      <rect x={node.x} y={node.y} width={w} height={h} rx={10}
        style={{ fill: s.fill, stroke: s.stroke, strokeWidth: sw, transition: T }} />
      <rect x={node.x+6} y={node.y} width={w-12} height={h} rx={7}
        fill="none" style={{ stroke: s.stroke, strokeWidth: 1 }} />
    </>;

  return <rect x={node.x} y={node.y} width={w} height={h} rx={10}
    style={{ fill: isS ? s.stroke : s.fill, fillOpacity: isS ? 0.14 : 1,
             stroke: isS || isH ? s.stroke : s.stroke,
             strokeWidth: sw, transition: T }} />;
}

function FlowNode({ node, hovered, selected, onHover, onSelect }) {
  const s  = STYLE[node.type];
  const { w, h } = sz(node);
  const cx = node.x + w / 2;
  const cy = node.y + h / 2;
  const isH = hovered  === node.id;
  const isS = selected === node.id;

  return (
    <g
      style={{
        cursor: "pointer",
        transformOrigin: `${cx}px ${cy}px`,
        transform: isS ? "scale(1.05)" : "scale(1)",
        transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        filter: isS
          ? `drop-shadow(0 4px 14px ${s.stroke}66)`
          : isH
          ? `drop-shadow(0 2px 8px ${s.stroke}44)`
          : "drop-shadow(0 1px 3px rgba(15,23,42,0.08))",
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(node.id)}
    >
      <NodeShape node={node} isH={isH} isS={isS} />

      {isS && node.type !== "decision" && (
        <rect x={node.x-4} y={node.y-4} width={w+8} height={h+8} rx={14}
          fill="none" stroke={s.stroke} strokeWidth={1.5}
          strokeDasharray="5 3" opacity={0.5}>
          <animate attributeName="stroke-dashoffset"
            from="0" to="-32" dur="1.2s" repeatCount="indefinite" />
        </rect>
      )}

      <text x={cx} y={cy}
        textAnchor="middle" dominantBaseline="central"
        fontSize={13} fontWeight={600} fill={s.text}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none", userSelect: "none" }}>
        {node.label}
      </text>
    </g>
  );
}

function Edge({ edge, nodeMap, selected }) {
  const fn = nodeMap[edge.from], tn = nodeMap[edge.to];
  if (!fn || !tn) return null;

  const fromSide = fn.y < tn.y ? "bottom" : fn.y > tn.y ? "top" : fn.x < tn.x ? "right" : "left";
  const toSide   = fn.y < tn.y ? "top"    : fn.y > tn.y ? "bottom" : fn.x < tn.x ? "left" : "right";

  const [x1, y1] = anchor(fn, fromSide);
  const [x2, y2] = anchor(tn, toSide);
  const dy = Math.abs(y2 - y1), dx = Math.abs(x2 - x1);
  const isHoriz = dy < 20;
  const bend = isHoriz ? dx * 0.45 : Math.max(dy * 0.42, 28);

  const c1x = isHoriz ? x1 + (x2>x1?bend:-bend) : x1;
  const c1y = isHoriz ? y1 : y1 + bend;
  const c2x = isHoriz ? x2 - (x2>x1?bend:-bend) : x2;
  const c2y = isHoriz ? y2 : y2 - bend;
  const d   = `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`;

  const isActive = selected === edge.from || selected === edge.to;
  const stroke   = isActive ? "#6366F1" : "#94A3B8";
  const sw       = isActive ? 2.2 : 1.5;
  const mx = (x1+x2)/2, my = (y1+y2)/2 - 10;

  return (
    <g opacity={selected && !isActive ? 0.18 : 1}
       style={{ transition: "opacity 0.2s" }}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={sw}
        markerEnd={isActive ? "url(#arr-hi)" : "url(#arr)"}
        style={{ transition: "stroke 0.2s, stroke-width 0.15s" }} />
      {edge.label && (
        <>
          <rect x={mx-20} y={my-9} width={40} height={18} rx={5}
            fill="#F1F5F9"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.07))" }} />
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

export default function Flowchart() {
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  return (
    <div style={{
      minHeight: "100vh", background: "#F8FAFC",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "32px 16px", fontFamily: "system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
    }}>
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: "clamp(16px,3vw,22px)",
                     fontWeight: 800, color: "#0F172A", letterSpacing: "-0.02em" }}>
          用户登录流程
        </h2>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#64748B" }}>
          含格式校验 · 身份认证 · Token 生成
        </p>
      </div>

      <div style={{
        background: "#FFFFFF", borderRadius: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08)",
        width: "100%", maxWidth: W + 32,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto"
             style={{ display: "block", minWidth: 380 }}>
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#94A3B8" />
            </marker>
            <marker id="arr-hi" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <path d="M0,0 L8,3 L0,6 Z" fill="#6366F1" />
            </marker>
          </defs>

          <rect width={W} height={H} fill="#FFFFFF" />

          {EDGES.map((e,i) =>
            <Edge key={i} edge={e} nodeMap={nodeMap} selected={selected} />)}

          {NODES.map(n =>
            <FlowNode key={n.id} node={n}
              hovered={hovered} selected={selected}
              onHover={setHovered}
              onSelect={id => setSelected(p => p === id ? null : id)} />)}
        </svg>
      </div>

      {/* 图例 */}
      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap",
                    gap: "8px 16px", justifyContent: "center" }}>
        {[
          ["terminal",  "开始/结束"],
          ["process",   "流程步骤"],
          ["decision",  "判断节点"],
          ["data",      "数据输入"],
          ["sub",       "子流程"],
          ["highlight", "关键步骤"],
          ["error",     "错误处理"],
        ].map(([type, label]) => {
          const s = STYLE[type];
          return (
            <span key={type} style={{ display: "flex", alignItems: "center",
                                      gap: 7, fontSize: 12, color: "#64748B" }}>
              <span style={{ width: 12, height: 12, borderRadius: 3,
                             background: s.fill, border: `2px solid ${s.stroke}`,
                             flexShrink: 0 }} />
              {label}
            </span>
          );
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: "#CBD5E1" }}>
        点击节点高亮关联路径 · 移动端可横向滑动
      </p>
    </div>
  );
}
