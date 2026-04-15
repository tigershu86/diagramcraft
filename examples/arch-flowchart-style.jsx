import { useState } from "react";

// ── 颜色系统（沿用 flowchart skill 扩展至架构图类型）──────────────
const STYLE = {
  client:   { fill: "#EFF6FF", stroke: "#BFDBFE", text: "#1E40AF", bar: "#3B82F6" },
  cdn:      { fill: "#ECFDF5", stroke: "#A7F3D0", text: "#065F46", bar: "#10B981" },
  lb:       { fill: "#FFFBEB", stroke: "#FDE68A", text: "#92400E", bar: "#F59E0B" },
  security: { fill: "#FDF4FF", stroke: "#F0ABFC", text: "#4A044E", bar: "#A21CAF" },
  gateway:  { fill: "#6366F1", stroke: "#4F46E5", text: "#FFFFFF", bar: "#4F46E5" },
  service:  { fill: "#F0FDF4", stroke: "#86EFAC", text: "#14532D", bar: "#16A34A" },
  cache:    { fill: "#FEF2F2", stroke: "#FCA5A5", text: "#991B1B", bar: "#E11D48" },
  database: { fill: "#EFF6FF", stroke: "#93C5FD", text: "#1D4ED8", bar: "#1D4ED8" },
  queue:    { fill: "#FFF7ED", stroke: "#FED7AA", text: "#7C2D12", bar: "#EA580C" },
  search:   { fill: "#FEFCE8", stroke: "#FEF08A", text: "#713F12", bar: "#CA8A04" },
  external: { fill: "#F8FAFC", stroke: "#CBD5E1", text: "#475569", bar: "#94A3B8" },
};

const W = 1100, H = 820;
const NW = 152, NH = 56;

const TIERS = [
  { label: "CLIENT",    y: 36,  h: 88  },
  { label: "EDGE",      y: 142, h: 88  },
  { label: "API",       y: 248, h: 88  },
  { label: "SERVICES",  y: 354, h: 112 },
  { label: "DATA",      y: 484, h: 192 },
  { label: "EXTERNAL",  y: 694, h: 84  },
];

// w/h 可选覆盖默认值
const NODES = [
  // CLIENT
  { id: "web",     label: "Web Client",    sub: "React / Next.js",   type: "client",   x: 246, y: 54  },
  { id: "mobile",  label: "Mobile App",    sub: "iOS & Android",     type: "client",   x: 426, y: 54  },
  { id: "admin",   label: "Admin Panel",   sub: "Internal Tools",    type: "client",   x: 606, y: 54  },
  // EDGE
  { id: "cdn",     label: "CDN",           sub: "CloudFront",        type: "cdn",      x: 166, y: 160 },
  { id: "lb",      label: "Load Balancer", sub: "NGINX / ALB",       type: "lb",       x: 426, y: 160 },
  { id: "waf",     label: "WAF",           sub: "Web App Firewall",  type: "security", x: 686, y: 160 },
  // API
  { id: "apigw",   label: "API Gateway",   sub: "Auth · Rate Limit", type: "gateway",  x: 376, y: 266, w: 200 },
  // SERVICES
  { id: "usersvc", label: "User Service",  sub: "Profile · Auth",    type: "service",  x: 36,  y: 378 },
  { id: "catalog", label: "Catalog",       sub: "Products · Search", type: "service",  x: 208, y: 378 },
  { id: "cart",    label: "Cart Service",  sub: "Sessions",          type: "service",  x: 380, y: 378 },
  { id: "order",   label: "Order Service", sub: "Checkout",          type: "service",  x: 552, y: 378 },
  { id: "notify",  label: "Notify",        sub: "Email · Push · SMS",type: "service",  x: 724, y: 378 },
  { id: "reco",    label: "Recommender",   sub: "ML Ranking",        type: "service",  x: 896, y: 378 },
  // DATA
  { id: "userdb",  label: "Users DB",      sub: "PostgreSQL",        type: "database", x: 36,  y: 514, h: 68 },
  { id: "proddb",  label: "Products DB",   sub: "PostgreSQL",        type: "database", x: 208, y: 514, h: 68 },
  { id: "orderdb", label: "Orders DB",     sub: "PostgreSQL",        type: "database", x: 380, y: 514, h: 68 },
  { id: "redis",   label: "Redis",         sub: "Cache · Sessions",  type: "cache",    x: 552, y: 512 },
  { id: "elastic", label: "Elasticsearch", sub: "Full-text Search",  type: "search",   x: 714, y: 512 },
  { id: "kafka",   label: "Kafka",         sub: "Event Streaming",   type: "queue",    x: 876, y: 512 },
  // EXTERNAL
  { id: "stripe",  label: "Stripe",        sub: "Payment",           type: "external", x: 270, y: 710 },
  { id: "sendgrid",label: "SendGrid",      sub: "Email Service",     type: "external", x: 450, y: 710 },
  { id: "twilio",  label: "Twilio",        sub: "SMS Gateway",       type: "external", x: 630, y: 710 },
];

const EDGES = [
  { f: "web",     t: "lb",      label: "HTTPS",   dash: false },
  { f: "mobile",  t: "lb",      label: "HTTPS",   dash: false },
  { f: "admin",   t: "lb",      label: "",        dash: false },
  { f: "waf",     t: "apigw",   label: "",        dash: false },
  { f: "lb",      t: "apigw",   label: "HTTP/2",  dash: false },
  { f: "apigw",   t: "usersvc", label: "REST",    dash: false },
  { f: "apigw",   t: "catalog", label: "REST",    dash: false },
  { f: "apigw",   t: "cart",    label: "REST",    dash: false },
  { f: "apigw",   t: "order",   label: "REST",    dash: false },
  { f: "order",   t: "notify",  label: "Event",   dash: true  },
  { f: "order",   t: "kafka",   label: "Publish", dash: false },
  { f: "kafka",   t: "reco",    label: "Consume", dash: true  },
  { f: "usersvc", t: "userdb",  label: "SQL",     dash: false },
  { f: "catalog", t: "proddb",  label: "SQL",     dash: false },
  { f: "order",   t: "orderdb", label: "SQL",     dash: false },
  { f: "cart",    t: "redis",   label: "Cache",   dash: false },
  { f: "catalog", t: "elastic", label: "Index",   dash: false },
  { f: "order",   t: "stripe",  label: "API",     dash: true  },
  { f: "notify",  t: "sendgrid",label: "SMTP",    dash: true  },
  { f: "notify",  t: "twilio",  label: "API",     dash: true  },
];

// ── 几何工具 ──────────────────────────────────────────────────────
function nw(n) { return n.w ?? NW; }
function nh(n) { return n.h ?? NH; }

function anchor(node, side) {
  const w = nw(node), h = nh(node);
  const cx = node.x + w / 2, cy = node.y + h / 2;
  if (side === "top")    return [cx, node.y];
  if (side === "bottom") return [cx, node.y + h];
  if (side === "left")   return [node.x, cy];
  if (side === "right")  return [node.x + w, cy];
  return [cx, cy];
}

function buildEdge(fn, tn) {
  const fcx = fn.x + nw(fn) / 2, fcy = fn.y + nh(fn) / 2;
  const tcx = tn.x + nw(tn) / 2, tcy = tn.y + nh(tn) / 2;
  const horiz = Math.abs(fcy - tcy) < 30;
  const fa = horiz ? (fcx < tcx ? "right" : "left") : "bottom";
  const ta = horiz ? (fcx < tcx ? "left"  : "right") : "top";
  const [x1, y1] = anchor(fn, fa);
  const [x2, y2] = anchor(tn, ta);
  const dy = Math.abs(y2 - y1), dx = Math.abs(x2 - x1);
  const bend = horiz ? dx * 0.42 : Math.max(dy * 0.42, 26);
  const c1x = fa === "right" ? x1 + bend : fa === "left" ? x1 - bend : x1;
  const c1y = fa === "bottom" ? y1 + bend : y1;
  const c2x = ta === "left" ? x2 - bend : ta === "right" ? x2 + bend : x2;
  const c2y = ta === "top" ? y2 - bend : y2;
  return { d: `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`,
           mx: (x1 + x2) / 2, my: (y1 + y2) / 2 - 8 };
}

// ── Node ──────────────────────────────────────────────────────────
function Node({ n, hovered, selected, onHover, onSelect }) {
  const s   = STYLE[n.type];
  const w   = nw(n), h = nh(n);
  const cx  = n.x + w / 2, cy = n.y + h / 2;
  const isH = hovered  === n.id;
  const isS = selected === n.id;
  const isAct = isH || isS;
  const sw  = isAct ? 2 : 1;
  const T   = "fill 0.22s ease, stroke 0.2s ease, stroke-width 0.18s ease";
  const isGateway = n.type === "gateway";
  const isService = n.type === "service";
  const isDB      = n.type === "database";
  const isExt     = n.type === "external";
  const clipId = `clip-${n.id}`;

  // 文字颜色跟随选中状态
  const textFill = isGateway
    ? "#FFFFFF"
    : isS ? s.bar : s.text;

  return (
    <g
      style={{
        cursor: "pointer",
        transformOrigin: `${cx}px ${cy}px`,
        transform: isS ? "scale(1.045)" : "scale(1)",
        transition: "transform 0.2s cubic-bezier(0.34,1.56,0.64,1)",
        filter: isS
          ? `drop-shadow(0 5px 14px ${s.bar}55)`
          : isH
          ? `drop-shadow(0 3px 8px ${s.bar}33)`
          : "drop-shadow(0 1px 3px rgba(15,23,42,0.07))",
      }}
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(n.id)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={n.x} y={n.y} width={w} height={h} rx={11} />
        </clipPath>
      </defs>

      {/* 主体矩形 */}
      {isService ? (
        // 服务节点：双边框（flowchart sub 形状）
        <>
          <rect x={n.x} y={n.y} width={w} height={h} rx={11}
            style={{
              fill: isS ? s.bar : s.fill,
              fillOpacity: isS ? 0.12 : 1,
              stroke: isAct ? s.bar : s.stroke,
              strokeWidth: sw, transition: T,
            }} />
          <rect x={n.x+5} y={n.y+4} width={w-10} height={h-8} rx={8}
            fill="none"
            style={{ stroke: isAct ? s.bar : s.stroke, strokeWidth: 0.75,
                     opacity: isAct ? 0.8 : 0.5, transition: T }} />
        </>
      ) : isDB ? (
        // 数据库节点：顶部半圆弧呈现"桶口"感
        <>
          <rect x={n.x} y={n.y + 10} width={w} height={h - 10} rx={5}
            style={{ fill: isS ? s.bar : s.fill, fillOpacity: isS ? 0.12 : 1,
                     stroke: isAct ? s.bar : s.stroke, strokeWidth: sw, transition: T }} />
          <ellipse cx={cx} cy={n.y + 10} rx={w / 2} ry={10}
            style={{ fill: isAct ? s.bar : s.fill, fillOpacity: isS ? 0.3 : isH ? 0.18 : 1,
                     stroke: isAct ? s.bar : s.stroke, strokeWidth: sw, transition: T }} />
        </>
      ) : (
        // 默认：圆角矩形
        <rect x={n.x} y={n.y} width={w} height={h} rx={11}
          style={{
            fill: isGateway ? (isS ? "#4F46E5" : "#6366F1") : (isS ? s.bar : s.fill),
            fillOpacity: (!isGateway && isS) ? 0.12 : 1,
            stroke: isAct ? s.bar : s.stroke,
            strokeWidth: sw,
            strokeDasharray: isExt ? "6 3" : "",
            transition: T,
          }} />
      )}

      {/* 顶部色条（非 gateway/database 节点才显示） */}
      {!isGateway && !isDB && (
        <rect x={n.x} y={n.y} width={w} height={5}
          fill={s.bar}
          clipPath={`url(#${clipId})`}
          style={{
            fillOpacity: isAct ? 0.6 : 0.22,
            transition: "fill-opacity 0.22s ease",
          }} />
      )}

      {/* 选中时旋转虚线外框 */}
      {isS && (
        <rect x={n.x - 5} y={n.y - 5} width={w + 10} height={h + 10}
          rx={15} fill="none" stroke={s.bar}
          strokeWidth={1.5} strokeDasharray="5 3" opacity={0.45}>
          <animate attributeName="stroke-dashoffset"
            from="0" to="-32" dur="1.2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* 标签 */}
      <text x={cx} y={isDB ? n.y + 10 + (h - 10) / 2 - 8 : cy - (n.sub ? 8 : 0)}
        textAnchor="middle" dominantBaseline="central"
        fontSize={12} fontWeight={700} fill={textFill}
        fontFamily="system-ui, -apple-system, sans-serif"
        style={{ pointerEvents: "none", userSelect: "none",
                 transition: "fill 0.2s ease" }}>
        {n.label}
      </text>
      {n.sub && (
        <text x={cx} y={isDB ? n.y + 10 + (h - 10) / 2 + 9 : cy + 9}
          textAnchor="middle" dominantBaseline="central"
          fontSize={9.5} fill={textFill}
          opacity={isGateway ? 0.75 : 0.5}
          fontFamily="system-ui, -apple-system, sans-serif"
          style={{ pointerEvents: "none", userSelect: "none",
                   transition: "fill 0.2s ease" }}>
          {n.sub}
        </text>
      )}
    </g>
  );
}

// ── Edge ──────────────────────────────────────────────────────────
function Edge({ edge, nodeMap, selected }) {
  const fn = nodeMap[edge.f], tn = nodeMap[edge.t];
  if (!fn || !tn) return null;
  const { d, mx, my } = buildEdge(fn, tn);
  const isConn = selected === edge.f || selected === edge.t;
  const isDim  = selected && !isConn;
  const color  = isConn ? STYLE[fn.type].bar : edge.dash ? "#CBD5E1" : "#94A3B8";
  const sw     = isConn ? 2.2 : edge.dash ? 1.2 : 1.5;

  return (
    <g opacity={isDim ? 0.15 : 1} style={{ transition: "opacity 0.2s" }}>
      <path d={d} fill="none"
        stroke={color} strokeWidth={sw}
        strokeDasharray={edge.dash ? "5 3" : ""}
        markerEnd="url(#arr)"
        style={{ transition: "stroke 0.2s, stroke-width 0.15s" }} />
      {edge.label && (
        <>
          <rect x={mx - 20} y={my - 9} width={40} height={18} rx={5}
            fill="#F1F5F9"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.06))" }} />
          <text x={mx} y={my + 1}
            textAnchor="middle" dominantBaseline="central"
            fontSize={9.5} fill={isConn ? color : "#64748B"} fontStyle="italic"
            fontFamily="system-ui, sans-serif">
            {edge.label}
          </text>
        </>
      )}
    </g>
  );
}

// ── Legend ────────────────────────────────────────────────────────
const LEGEND = [
  ["client",   "Client"       ],
  ["cdn",      "CDN / Edge"   ],
  ["lb",       "Load Balancer"],
  ["gateway",  "API Gateway"  ],
  ["service",  "Microservice" ],
  ["database", "Database"     ],
  ["cache",    "Cache"        ],
  ["queue",    "Queue"        ],
  ["external", "External"     ],
];

// ── Main ──────────────────────────────────────────────────────────
export default function ArchDiagram() {
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F8FAFC",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "32px 16px 44px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
    }}>

      {/* 标题 */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: "clamp(17px,3.5vw,24px)",
                     fontWeight: 800, color: "#0F172A", letterSpacing: "-0.03em" }}>
          E-Commerce Platform Architecture
        </h2>
        <p style={{ margin: "7px 0 0", fontSize: 13, color: "#64748B" }}>
          Microservices · Event-Driven · Horizontally Scalable
        </p>
      </div>

      {/* 画布 */}
      <div style={{
        width: "100%", maxWidth: W + 32,
        overflowX: "auto", WebkitOverflowScrolling: "touch",
        borderRadius: 16, background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.09)",
      }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="auto"
             style={{ display: "block", minWidth: 560 }}>
          <defs>
            <marker id="arr" markerWidth="7" markerHeight="5"
              refX="6" refY="2.5" orient="auto">
              <path d="M0,0 L7,2.5 L0,5 Z" fill="#94A3B8" />
            </marker>
          </defs>

          <rect width={W} height={H} fill="#FFFFFF" />

          {/* 分层背景 */}
          {TIERS.map(t => (
            <g key={t.label}>
              <rect x={12} y={t.y} width={W - 24} height={t.h}
                rx={8} fill="rgba(248,250,252,0.8)" stroke="#E2E8F0" strokeWidth={1} />
              <text x={24} y={t.y + 15} fontSize={9} fontWeight={800}
                letterSpacing={1.8} fill="#CBD5E1"
                fontFamily="system-ui, sans-serif">
                {t.label}
              </text>
            </g>
          ))}

          {/* 连线（节点下层） */}
          {EDGES.map((e, i) =>
            <Edge key={i} edge={e} nodeMap={nodeMap} selected={selected} />)}

          {/* 节点 */}
          {NODES.map(n =>
            <Node key={n.id} n={n}
              hovered={hovered} selected={selected}
              onHover={setHovered}
              onSelect={id => setSelected(p => p === id ? null : id)} />)}
        </svg>
      </div>

      {/* 图例 */}
      <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap",
                    gap: "8px 18px", justifyContent: "center", maxWidth: 640 }}>
        {LEGEND.map(([type, label]) => {
          const s = STYLE[type];
          return (
            <span key={type} style={{ display: "flex", alignItems: "center",
                                      gap: 7, fontSize: 12, color: "#64748B" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%",
                             background: s.bar, flexShrink: 0 }} />
              {label}
            </span>
          );
        })}
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: "#CBD5E1" }}>
        点击节点高亮连线 · 移动端可横向滑动
      </p>
    </div>
  );
}
