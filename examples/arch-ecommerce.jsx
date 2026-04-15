import { useState } from "react";

// ── Color palette by component type ─────────────────────────────────────
const C = {
  client:   { fill: "#EFF6FF", stroke: "#BFDBFE", dot: "#3B82F6", text: "#1E40AF" },
  cdn:      { fill: "#ECFDF5", stroke: "#A7F3D0", dot: "#10B981", text: "#065F46" },
  lb:       { fill: "#FFFBEB", stroke: "#FDE68A", dot: "#F59E0B", text: "#92400E" },
  security: { fill: "#FDF4FF", stroke: "#F0ABFC", dot: "#A21CAF", text: "#4A044E" },
  gateway:  { fill: "#F5F3FF", stroke: "#DDD6FE", dot: "#7C3AED", text: "#3B0764" },
  service:  { fill: "#F0FDF4", stroke: "#BBF7D0", dot: "#16A34A", text: "#14532D" },
  cache:    { fill: "#FFF1F2", stroke: "#FECDD3", dot: "#E11D48", text: "#881337" },
  database: { fill: "#EFF6FF", stroke: "#BFDBFE", dot: "#1D4ED8", text: "#1E3A5F" },
  queue:    { fill: "#FFF7ED", stroke: "#FED7AA", dot: "#EA580C", text: "#7C2D12" },
  search:   { fill: "#FEFCE8", stroke: "#FEF08A", dot: "#CA8A04", text: "#713F12" },
  external: { fill: "#F8FAFC", stroke: "#CBD5E1", dot: "#64748B", text: "#334155" },
};

const W = 1120, H = 800;
const NW = 152, NH = 60;

const TIERS = [
  { label: "CLIENT",    y: 36,  h: 86  },
  { label: "EDGE",      y: 140, h: 86  },
  { label: "API",       y: 244, h: 86  },
  { label: "SERVICES",  y: 348, h: 110 },
  { label: "DATA",      y: 476, h: 190 },
  { label: "EXTERNAL",  y: 684, h: 82  },
];

const NODES = [
  // CLIENT
  { id: "web",      label: "Web Client",     sub: "React / Next.js",    type: "client",   x: 246, y: 53  },
  { id: "mobile",   label: "Mobile App",     sub: "iOS & Android",      type: "client",   x: 426, y: 53  },
  { id: "admin",    label: "Admin Panel",    sub: "Internal Tools",     type: "client",   x: 606, y: 53  },
  // EDGE
  { id: "cdn",      label: "CDN",            sub: "CloudFront",         type: "cdn",      x: 166, y: 157 },
  { id: "lb",       label: "Load Balancer",  sub: "NGINX / ALB",        type: "lb",       x: 426, y: 157 },
  { id: "waf",      label: "WAF",            sub: "Web App Firewall",   type: "security", x: 686, y: 157 },
  // API
  { id: "apigw",    label: "API Gateway",    sub: "Auth · Rate Limit",  type: "gateway",  x: 376, y: 261, w: 200 },
  // SERVICES
  { id: "usersvc",  label: "User Service",   sub: "Profile · Auth",     type: "service",  x: 36,  y: 370 },
  { id: "catalog",  label: "Catalog",        sub: "Products · Search",  type: "service",  x: 208, y: 370 },
  { id: "cart",     label: "Cart Service",   sub: "Sessions · Pricing", type: "service",  x: 380, y: 370 },
  { id: "order",    label: "Order Service",  sub: "Checkout · Payment", type: "service",  x: 552, y: 370 },
  { id: "notify",   label: "Notify",         sub: "Email · Push · SMS", type: "service",  x: 724, y: 370 },
  { id: "recosvc",  label: "Recommender",    sub: "ML Ranking",         type: "service",  x: 896, y: 370 },
  // DATA
  { id: "userdb",   label: "Users DB",       sub: "PostgreSQL",         type: "database", x: 36,  y: 504, h: 72 },
  { id: "proddb",   label: "Products DB",    sub: "PostgreSQL",         type: "database", x: 208, y: 504, h: 72 },
  { id: "orderdb",  label: "Orders DB",      sub: "PostgreSQL",         type: "database", x: 380, y: 504, h: 72 },
  { id: "redis",    label: "Redis",          sub: "Cache · Sessions",   type: "cache",    x: 552, y: 502 },
  { id: "elastic",  label: "Elasticsearch",  sub: "Full-text Search",   type: "search",   x: 714, y: 502 },
  { id: "kafka",    label: "Kafka",          sub: "Event Streaming",    type: "queue",    x: 876, y: 502 },
  // EXTERNAL
  { id: "stripe",   label: "Stripe",         sub: "Payment Gateway",    type: "external", x: 270, y: 701 },
  { id: "sendgrid", label: "SendGrid",       sub: "Email Service",      type: "external", x: 450, y: 701 },
  { id: "twilio",   label: "Twilio",         sub: "SMS Gateway",        type: "external", x: 630, y: 701 },
];

const EDGES = [
  { f: "web",     t: "cdn",      label: "",        dash: false },
  { f: "web",     t: "lb",       label: "HTTPS",   dash: false },
  { f: "mobile",  t: "lb",       label: "HTTPS",   dash: false },
  { f: "admin",   t: "lb",       label: "",        dash: false },
  { f: "waf",     t: "apigw",    label: "",        dash: false },
  { f: "lb",      t: "apigw",    label: "HTTP/2",  dash: false },
  { f: "apigw",   t: "usersvc",  label: "REST",    dash: false },
  { f: "apigw",   t: "catalog",  label: "REST",    dash: false },
  { f: "apigw",   t: "cart",     label: "REST",    dash: false },
  { f: "apigw",   t: "order",    label: "REST",    dash: false },
  { f: "order",   t: "notify",   label: "Event",   dash: true  },
  { f: "order",   t: "kafka",    label: "Publish", dash: false },
  { f: "kafka",   t: "recosvc",  label: "Consume", dash: true  },
  { f: "usersvc", t: "userdb",   label: "SQL",     dash: false },
  { f: "catalog", t: "proddb",   label: "SQL",     dash: false },
  { f: "order",   t: "orderdb",  label: "SQL",     dash: false },
  { f: "cart",    t: "redis",    label: "Cache",   dash: false },
  { f: "catalog", t: "elastic",  label: "Index",   dash: false },
  { f: "order",   t: "stripe",   label: "API",     dash: true  },
  { f: "notify",  t: "sendgrid", label: "SMTP",    dash: true  },
  { f: "notify",  t: "twilio",   label: "API",     dash: true  },
];

// ── Geometry helpers ─────────────────────────────────────────────────────
function nw(n) { return n.w ?? NW; }
function nh(n) { return n.h ?? NH; }

function anchorPt(n, side) {
  const w = nw(n), h = nh(n);
  const cx = n.x + w / 2, cy = n.y + h / 2;
  return side === "top"    ? [cx, n.y]
       : side === "bottom" ? [cx, n.y + h]
       : side === "left"   ? [n.x, cy]
       :                     [n.x + w, cy];
}

function buildPath(fn, tn) {
  const fcx = fn.x + nw(fn) / 2, fcy = fn.y + nh(fn) / 2;
  const tcx = tn.x + nw(tn) / 2, tcy = tn.y + nh(tn) / 2;
  const horizontal = Math.abs(fcy - tcy) < 35;
  const fa = horizontal ? (fcx < tcx ? "right" : "left") : "bottom";
  const ta = horizontal ? (fcx < tcx ? "left"  : "right") : "top";
  const [x1, y1] = anchorPt(fn, fa);
  const [x2, y2] = anchorPt(tn, ta);
  const bend = horizontal ? Math.abs(x2 - x1) * 0.4 : Math.abs(y2 - y1) * 0.45;
  const c1x = fa === "right" ? x1 + bend : fa === "left" ? x1 - bend : x1;
  const c1y = fa === "bottom" ? y1 + bend : fa === "top" ? y1 - bend : y1;
  const c2x = ta === "left"  ? x2 - bend : ta === "right" ? x2 + bend : x2;
  const c2y = ta === "top"   ? y2 - bend : ta === "bottom" ? y2 + bend : y2;
  return {
    d: `M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}`,
    mx: (x1 + x2) / 2,
    my: (y1 + y2) / 2 - 6,
  };
}

// ── Node component ───────────────────────────────────────────────────────
function Node({ n, hovered, selected, ripples, onHover, onSelect }) {
  const col   = C[n.type];
  const w     = nw(n), h = nh(n);
  const cx    = n.x + w / 2;
  const isDB  = n.type === "database";
  const isH   = hovered  === n.id;
  const isS   = selected === n.id;
  const isAct = isH || isS;
  const rKey  = ripples[n.id];

  const bodyCy = isDB ? n.y + 14 + (h - 14) / 2 : n.y + h / 2;
  const labelY = bodyCy - 9;
  const subY   = bodyCy + 9;
  const clipId = `clip-${n.id}`;

  const T = "stroke 0.22s ease, stroke-width 0.18s ease, fill 0.22s ease, fill-opacity 0.22s ease";

  // CSS drop-shadow filter — one clean shadow for the whole node
  const shadowFilter = isS
    ? `drop-shadow(0 6px 16px ${col.dot}50)`
    : isH
    ? `drop-shadow(0 4px 10px ${col.dot}30)`
    : "drop-shadow(0 1px 4px rgba(15,23,42,0.08))";

  return (
    <g
      style={{
        cursor: "pointer",
        transformOrigin: `${cx}px ${bodyCy}px`,
        transform: isS ? "scale(1.045)" : "scale(1)",
        transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), filter 0.22s ease",
        filter: shadowFilter,
      }}
      onMouseEnter={() => onHover(n.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(n.id)}
    >
      <defs>
        {/* Clip shape — used for the top colour bar so corners match */}
        <clipPath id={clipId}>
          {isDB
            ? <rect x={n.x} y={n.y + 14} width={w} height={h - 14} rx={5} />
            : <rect x={n.x} y={n.y}       width={w} height={h}      rx={11} />}
        </clipPath>
      </defs>

      {isDB ? (
        // ── Cylinder ───────────────────────────────────────────────────
        <g>
          {/* Body */}
          <rect x={n.x} y={n.y + 14} width={w} height={h - 14} rx={5}
            style={{
              fill:        col.fill,
              stroke:      isAct ? col.dot : col.stroke,
              strokeWidth: isAct ? 1.8 : 1,
              transition:  T,
            }} />
          {/* Tint overlay — uniform on body */}
          <rect x={n.x} y={n.y + 14} width={w} height={h - 14} rx={5}
            style={{
              fill:          col.dot,
              fillOpacity:   isS ? 0.1 : isH ? 0.05 : 0,
              pointerEvents: "none",
              transition:    "fill-opacity 0.22s ease",
            }} />
          {/* Bottom ellipse */}
          <ellipse cx={cx} cy={n.y + h} rx={w / 2} ry={10}
            style={{
              fill:        col.fill,
              stroke:      isAct ? col.dot : col.stroke,
              strokeWidth: isAct ? 1.8 : 1,
              transition:  T,
            }} />
          {/* Top cap */}
          <ellipse cx={cx} cy={n.y + 14} rx={w / 2} ry={10}
            style={{
              fill:        isAct ? col.dot : col.fill,
              fillOpacity: isS ? 0.35 : isH ? 0.2 : 1,
              stroke:      isAct ? col.dot : col.stroke,
              strokeWidth: isAct ? 1.8 : 1,
              transition:  T,
            }} />
        </g>
      ) : (
        // ── Regular card ───────────────────────────────────────────────
        <g>
          {/* Card — single rect, single border, no overlap */}
          <rect x={n.x} y={n.y} width={w} height={h} rx={11}
            style={{
              fill:        isS ? col.dot : col.fill,
              fillOpacity: isS ? 0.11 : 1,
              stroke:      isAct ? col.dot : col.stroke,
              strokeWidth: isAct ? 1.8 : 1,
              transition:  T,
            }} />
          {/* Top colour bar — clipped to card's own rounded shape, no overflow */}
          <rect x={n.x} y={n.y} width={w} height={6}
            fill={col.dot}
            clipPath={`url(#${clipId})`}
            style={{
              fillOpacity: isAct ? 0.6 : 0.28,
              transition:  "fill-opacity 0.22s ease",
            }} />
        </g>
      )}

      {/* Selection ring */}
      {isS && (
        <rect
          x={n.x - 5} y={n.y - 5}
          width={w + 10} height={(isDB ? h + 20 : h) + 10}
          rx={15} fill="none"
          stroke={col.dot} strokeWidth={1.5}
          strokeDasharray="5 3" opacity={0.45}
        >
          <animate attributeName="stroke-dashoffset"
            from="0" to="-32" dur="1.2s" repeatCount="indefinite" />
        </rect>
      )}

      {/* Ripple */}
      {rKey && (
        <circle key={rKey} cx={cx} cy={bodyCy} fill="none"
          stroke={col.dot} strokeWidth={2}>
          <animate attributeName="r"
            from={Math.max(w, h) * 0.38} to={Math.max(w, h) * 0.72}
            dur="0.55s" fill="freeze" />
          <animate attributeName="opacity"
            values="0.6;0" dur="0.55s" fill="freeze" />
          <animate attributeName="stroke-width"
            values="2;0.5" dur="0.55s" fill="freeze" />
        </circle>
      )}

      {/* Label */}
      <text x={cx} y={labelY}
        textAnchor="middle" dominantBaseline="central"
        fontSize={12} fontWeight={700} fill={col.text}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif">
        {n.label}
      </text>

      {/* Sublabel */}
      <text x={cx} y={subY}
        textAnchor="middle" dominantBaseline="central"
        fontSize={9.5} fill={col.text} opacity={0.5}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, sans-serif">
        {n.sub}
      </text>
    </g>
  );
}

// ── Edge component ───────────────────────────────────────────────────────
function Edge({ edge, nodeMap, selected }) {
  const fn = nodeMap[edge.f], tn = nodeMap[edge.t];
  if (!fn || !tn) return null;
  const { d, mx, my } = buildPath(fn, tn);

  // Highlight if connected to selected node; dim everything else when something is selected
  const isConnected = selected && (edge.f === selected || edge.t === selected);
  const isDimmed    = selected && !isConnected;
  const accentCol   = isConnected
    ? C[nodeMap[edge.f]?.type]?.dot ?? "#64748B"
    : edge.dash ? "#CBD5E1" : "#94A3B8";

  return (
    <g opacity={isDimmed ? 0.2 : 1}
       style={{ transition: "opacity 0.2s" }}>
      <path d={d} fill="none"
        stroke={accentCol}
        strokeWidth={isConnected ? 2.2 : edge.dash ? 1.2 : 1.5}
        strokeDasharray={edge.dash ? "5 3" : ""}
        markerEnd={isConnected ? "url(#arr-active)" : "url(#arr)"}
        opacity={isConnected ? 1 : 0.85}
      />
      {edge.label && (
        <text x={mx} y={my}
          textAnchor="middle" dominantBaseline="central"
          fontSize={9} fill={isConnected ? accentCol : "#94A3B8"}
          fontWeight={isConnected ? 600 : 400}
          fontStyle={isConnected ? "normal" : "italic"}
          fontFamily="system-ui, sans-serif">
          {edge.label}
        </text>
      )}
    </g>
  );
}

// ── Legend ───────────────────────────────────────────────────────────────
const LEGEND = [
  ["client",   "Client"       ],
  ["cdn",      "CDN / Edge"   ],
  ["lb",       "Load Balancer"],
  ["gateway",  "API Gateway"  ],
  ["service",  "Service"      ],
  ["database", "Database"     ],
  ["cache",    "Cache"        ],
  ["queue",    "Queue"        ],
  ["external", "External"     ],
];

// ── Main ─────────────────────────────────────────────────────────────────
export default function ArchDiagram() {
  const [hovered,  setHovered]  = useState(null);
  const [selected, setSelected] = useState(null);
  const [ripples,  setRipples]  = useState({});   // {nodeId: timestamp}

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  function handleSelect(nodeId) {
    setSelected(prev => prev === nodeId ? null : nodeId);
    setRipples(prev => ({ ...prev, [nodeId]: Date.now() }));
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F1F5F9",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "32px 16px 48px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      boxSizing: "border-box",
    }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <h1 style={{
          margin: 0,
          fontSize: "clamp(17px, 3.5vw, 25px)",
          fontWeight: 800,
          color: "#0F172A",
          letterSpacing: "-0.03em",
        }}>
          E-Commerce Platform Architecture
        </h1>
        <p style={{ margin: "7px 0 0", fontSize: 13, color: "#64748B" }}>
          Microservices · Event-Driven · Horizontally Scalable
        </p>
      </div>

      {/* Diagram */}
      <div style={{
        width: "100%",
        maxWidth: W + 32,
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        borderRadius: 16,
        background: "#FFFFFF",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 40px rgba(0,0,0,0.09)",
      }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="auto"
          style={{ display: "block", minWidth: 560 }}
        >
          <defs>
            <marker id="arr" markerWidth="7" markerHeight="5"
              refX="6" refY="2.5" orient="auto">
              <path d="M0,0 L7,2.5 L0,5 Z" fill="#94A3B8" />
            </marker>
            <marker id="arr-active" markerWidth="7" markerHeight="5"
              refX="6" refY="2.5" orient="auto">
              <path d="M0,0 L7,2.5 L0,5 Z" fill="currentColor" />
            </marker>
          </defs>

          <rect width={W} height={H} fill="#FFFFFF" />

          {/* Tier backgrounds */}
          {TIERS.map(t => (
            <g key={t.label}>
              <rect x={12} y={t.y} width={W - 24} height={t.h}
                rx={8}
                fill="rgba(248,250,252,0.8)"
                stroke="#E2E8F0"
                strokeWidth={1}
              />
              <text x={24} y={t.y + 15}
                fontSize={9} fontWeight={700} letterSpacing={1.8}
                fill="#94A3B8"
                fontFamily="system-ui, sans-serif">
                {t.label}
              </text>
            </g>
          ))}

          {/* Edges (below nodes) */}
          {EDGES.map((e, i) => (
            <Edge key={i} edge={e} nodeMap={nodeMap} selected={selected} />
          ))}

          {/* Nodes */}
          {NODES.map(n => (
            <Node key={n.id} n={n}
              hovered={hovered} selected={selected} ripples={ripples}
              onHover={setHovered} onSelect={handleSelect} />
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div style={{
        marginTop: 20,
        display: "flex",
        flexWrap: "wrap",
        gap: "8px 20px",
        justifyContent: "center",
        maxWidth: 620,
      }}>
        {LEGEND.map(([type, label]) => (
          <span key={type} style={{
            display: "flex", alignItems: "center", gap: 7,
            fontSize: 12, color: "#64748B",
          }}>
            <span style={{
              width: 10, height: 10,
              borderRadius: "50%",
              background: C[type].dot,
              flexShrink: 0,
            }} />
            {label}
          </span>
        ))}
      </div>

      <p style={{ marginTop: 14, fontSize: 11, color: "#CBD5E1" }}>
        Hover to highlight · swipe to scroll on mobile
      </p>
    </div>
  );
}
