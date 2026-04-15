---
name: arch-diagram
description: Generate beautiful system architecture diagrams in the ByteByteGo visual style — clean layered layouts, color-coded components, directional arrows, and grouped tiers. Use this skill whenever the user asks to draw, create, visualize, or design any system architecture, infrastructure diagram, microservice map, data flow diagram, cloud architecture, or component diagram. Also trigger for requests like "画架构图", "系统设计图", "帮我画一个...的架构", "show me how X works", or any description of a technical system that would benefit from visual explanation. Always use this skill even for simple two-component diagrams — visual output is always better.
---

# Architecture Diagram Skill — ByteByteGo Style

Produce **interactive, publication-quality system architecture diagrams** as React JSX artifacts, rendered with SVG, following the ByteByteGo visual language.

---

## Step 1 — Understand the Architecture

Before writing any code, extract from the user's request:

1. **System name** — e.g., "URL Shortener", "E-commerce Platform", "Chat App"
2. **Components** — list every node: clients, gateways, services, databases, caches, queues, CDNs, external APIs
3. **Data flows** — which components communicate, in what direction, with what label (e.g., "HTTPS", "gRPC", "SQL Query")
4. **Layers/Tiers** — how to group components (Client Layer → API Layer → Service Layer → Data Layer)
5. **Scale/complexity** — simple (2–5 nodes), medium (6–12), complex (13+)

If the user's request is vague (e.g., "画一个电商系统架构图"), generate a sensible canonical architecture for that system type. Do **not** ask for clarification — produce the diagram immediately with reasonable defaults, then invite feedback.

---

## Step 2 — Plan the Layout

Always use a **top-to-bottom tiered layout**:

```
[Tier 0] Internet / Client
    ↓
[Tier 1] Edge (CDN, DNS, Load Balancer)
    ↓
[Tier 2] API / Gateway Layer
    ↓
[Tier 3] Application / Microservices
    ↓
[Tier 4] Data Layer (DB, Cache, Queue, Storage)
    ↓
[Tier 5] External Services (optional)
```

For each tier, lay components **horizontally** across the tier. Tiers have labeled background zones.

---

## Step 3 — Apply the ByteByteGo Visual Language

### Color Palette (use exactly these per component type)

| Component Type | Fill Color | Border | Text |
|---|---|---|---|
| Client / Browser / Mobile | `#E8F4FD` | `#2E86C1` | `#1A5276` |
| CDN | `#E8F8F5` | `#1ABC9C` | `#0E6655` |
| DNS | `#F4ECF7` | `#8E44AD` | `#6C3483` |
| Load Balancer | `#FEF9E7` | `#F39C12` | `#9A7D0A` |
| API Gateway | `#EBF5FB` | `#2980B9` | `#1A5276` |
| Microservice / Service | `#EAFAF1` | `#27AE60` | `#1E8449` |
| Cache (Redis/Memcached) | `#FDEDEC` | `#E74C3C` | `#922B21` |
| SQL Database | `#EBF5FB` | `#2471A3` | `#1A5276` |
| NoSQL Database | `#F0F3FF` | `#5B5EA6` | `#3C3F8C` |
| Message Queue | `#FFF3E0` | `#E67E22` | `#935116` |
| Object Storage / Blob | `#E8F8F5` | `#17A589` | `#0E6655` |
| Search Engine | `#FEF9E7` | `#D4AC0D` | `#9A7D0A` |
| External Service / 3rd Party | `#F2F3F4` | `#95A5A6` | `#566573` |
| Monitoring / Observability | `#F9F0FF` | `#8E44AD` | `#6C3483` |

### Background Tier Colors

```
Tier zone fill:   rgba(248, 249, 250, 0.8)  — very light gray
Tier zone border: #DEE2E6  — subtle gray border
Canvas BG:        #F8F9FA  — warm near-white (never pure white)
```

### Component Shapes

- **Services, Gateways, Load Balancers, CDN** → rounded rectangle (rx=8)
- **Databases (SQL/NoSQL)** → cylinder shape (see SVG pattern below)
- **Cache** → rounded rectangle with a slight red tint, labeled with ⚡
- **Message Queue** → rounded rectangle with queue icon (▶▶)
- **Client/Browser** → rounded rectangle with 🌐 or device icon
- **External Service** → dashed-border rounded rectangle

### Typography

```
Component label:  font-family: 'Segoe UI', system-ui, sans-serif
                  font-size: 13px, font-weight: 600
Sublabel/type:    font-size: 11px, font-weight: 400, opacity: 0.7
Tier label:       font-size: 11px, font-weight: 700, letter-spacing: 0.08em
                  text-transform: uppercase, color: #6C757D
Arrow label:      font-size: 10px, font-style: italic, fill: #495057
```

### Arrows

- Use SVG `<path>` with marker-end arrowhead
- Stroke: `#6C757D`, strokeWidth: 1.5, no fill
- Label arrows with protocol/action when meaningful (e.g., "HTTPS", "gRPC", "Pub/Sub", "SQL")
- Use curved paths (`Q` cubic Bezier) for cross-tier arrows; straight for same-tier
- Arrowhead: small filled triangle, color `#6C757D`

### Component Icons (use emoji or simple SVG text)

| Type | Icon |
|---|---|
| Client/Browser | 🌐 |
| Mobile | 📱 |
| Load Balancer | ⚖️ |
| API Gateway | 🔀 |
| Cache | ⚡ |
| SQL DB | 🗄️ |
| NoSQL DB | 📦 |
| Queue | 📨 |
| CDN | 🌍 |
| Search | 🔍 |
| Storage | 💾 |
| Auth | 🔐 |
| Monitoring | 📊 |
| External | 🔗 |

---

## Step 4 — Generate the React JSX Artifact

Output a **single `.jsx` React artifact** using only inline SVG — no external libraries needed.

### Structure Template

```jsx
import { useState } from "react";

// ─── DATA MODEL ────────────────────────────────────────────────
const DIAGRAM = {
  title: "System Name",
  subtitle: "Optional description",
  width: 900,   // adjust to content
  height: 700,  // adjust to content

  tiers: [
    { id: "client",  label: "CLIENT LAYER",   y: 40,  height: 100, color: "rgba(232,244,253,0.4)" },
    { id: "edge",    label: "EDGE LAYER",      y: 160, height: 100, color: "rgba(232,248,245,0.4)" },
    { id: "api",     label: "API LAYER",       y: 280, height: 100, color: "rgba(235,245,251,0.4)" },
    { id: "service", label: "SERVICE LAYER",   y: 400, height: 120, color: "rgba(234,250,241,0.4)" },
    { id: "data",    label: "DATA LAYER",      y: 540, height: 120, color: "rgba(253,237,236,0.2)" },
  ],

  nodes: [
    {
      id: "browser",
      label: "Web Client",
      sublabel: "Browser",
      icon: "🌐",
      x: 400, y: 70,
      width: 120, height: 56,
      fill: "#E8F4FD", stroke: "#2E86C1", textColor: "#1A5276",
      shape: "rect",  // "rect" | "cylinder" | "dashed-rect"
    },
    // ... more nodes
  ],

  edges: [
    {
      from: "browser",
      to: "loadbalancer",
      label: "HTTPS",
      // fromAnchor/toAnchor: "top" | "bottom" | "left" | "right"
      fromAnchor: "bottom",
      toAnchor: "top",
    },
    // ... more edges
  ],
};

// ─── RENDERING HELPERS ─────────────────────────────────────────

function getAnchorPoint(node, anchor) {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  switch (anchor) {
    case "top":    return [cx, node.y];
    case "bottom": return [cx, node.y + node.height];
    case "left":   return [node.x, cy];
    case "right":  return [node.x + node.width, cy];
    default:       return [cx, cy];
  }
}

function Arrow({ edge, nodes }) {
  const fromNode = nodes.find(n => n.id === edge.from);
  const toNode   = nodes.find(n => n.id === edge.to);
  if (!fromNode || !toNode) return null;

  const [x1, y1] = getAnchorPoint(fromNode, edge.fromAnchor || "bottom");
  const [x2, y2] = getAnchorPoint(toNode,   edge.toAnchor   || "top");

  // Bezier control point
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const d = `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;

  const midX = (x1 * 0.25 + x2 * 0.25 + mx * 0.5);
  const midY = (y1 * 0.25 + y2 * 0.25 + my * 0.5);

  return (
    <g>
      <path d={d} stroke="#6C757D" strokeWidth="1.5" fill="none"
            markerEnd="url(#arrowhead)" strokeDasharray={edge.dashed ? "5,3" : ""} />
      {edge.label && (
        <text x={midX} y={midY - 4} textAnchor="middle"
              fontSize="10" fill="#495057" fontStyle="italic"
              fontFamily="'Segoe UI', system-ui, sans-serif">
          {edge.label}
        </text>
      )}
    </g>
  );
}

function Node({ node, onHover, hovered }) {
  const isHovered = hovered === node.id;
  const { x, y, width, height, fill, stroke, textColor, label, sublabel, icon, shape } = node;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const elevate = isHovered ? -2 : 0;

  const boxStyle = {
    filter: isHovered ? "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" : "drop-shadow(0 2px 4px rgba(0,0,0,0.08))",
    cursor: "pointer",
    transition: "filter 0.15s ease",
  };

  return (
    <g transform={`translate(0,${elevate})`} style={boxStyle}
       onMouseEnter={() => onHover(node.id)}
       onMouseLeave={() => onHover(null)}>
      {shape === "cylinder" ? (
        // Database cylinder shape
        <>
          <rect x={x} y={y + 12} width={width} height={height - 12}
                rx="4" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <ellipse cx={cx} cy={y + 12} rx={width / 2} ry={10}
                   fill={fill} stroke={stroke} strokeWidth="1.5" />
          <ellipse cx={cx} cy={y + 12} rx={width / 2 - 1} ry={9}
                   fill={isHovered ? stroke : fill} opacity={isHovered ? 0.15 : 0.05}
                   stroke="none" />
        </>
      ) : shape === "dashed-rect" ? (
        <rect x={x} y={y} width={width} height={height} rx="8"
              fill={fill} stroke={stroke} strokeWidth="1.5" strokeDasharray="6,3" />
      ) : (
        <rect x={x} y={y} width={width} height={height} rx="8"
              fill={fill} stroke={stroke} strokeWidth="1.5" />
      )}

      {/* Icon */}
      {icon && (
        <text x={cx - (label ? width * 0.18 : 0)} y={cy - (sublabel ? 8 : 4)}
              textAnchor="middle" fontSize="18"
              fontFamily="'Segoe UI Emoji', 'Apple Color Emoji', sans-serif">
          {icon}
        </text>
      )}

      {/* Label */}
      <text x={icon ? cx + width * 0.12 : cx}
            y={sublabel ? cy - 2 : cy + 5}
            textAnchor="middle"
            fontSize="13" fontWeight="600" fill={textColor}
            fontFamily="'Segoe UI', system-ui, sans-serif">
        {label}
      </text>

      {/* Sublabel */}
      {sublabel && (
        <text x={icon ? cx + width * 0.12 : cx} y={cy + 14}
              textAnchor="middle"
              fontSize="11" fill={textColor} opacity="0.65"
              fontFamily="'Segoe UI', system-ui, sans-serif">
          {sublabel}
        </text>
      )}
    </g>
  );
}

// ─── MAIN COMPONENT ────────────────────────────────────────────
export default function ArchDiagram() {
  const [hovered, setHovered] = useState(null);
  const { title, subtitle, width, height, tiers, nodes, edges } = DIAGRAM;

  return (
    <div style={{
      background: "#F8F9FA", minHeight: "100vh", display: "flex",
      flexDirection: "column", alignItems: "center",
      padding: "32px 24px", fontFamily: "'Segoe UI', system-ui, sans-serif"
    }}>
      {/* Header */}
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#212529", letterSpacing: "-0.02em" }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#6C757D" }}>{subtitle}</p>
        )}
      </div>

      {/* SVG Canvas */}
      <svg width={width} height={height}
           style={{ maxWidth: "100%", borderRadius: 12,
                    boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
                    background: "#FFFFFF" }}>
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6"
                  refX="7" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6C757D" />
          </marker>
        </defs>

        {/* Tier Backgrounds */}
        {tiers.map(tier => (
          <g key={tier.id}>
            <rect x={16} y={tier.y} width={width - 32} height={tier.height}
                  rx="8" fill={tier.color} stroke="#DEE2E6" strokeWidth="1" />
            <text x={28} y={tier.y + 16} fontSize="11" fontWeight="700"
                  fill="#6C757D" letterSpacing="0.08em"
                  fontFamily="'Segoe UI', system-ui, sans-serif">
              {tier.label}
            </text>
          </g>
        ))}

        {/* Edges (draw below nodes) */}
        {edges.map((edge, i) => (
          <Arrow key={i} edge={edge} nodes={nodes} />
        ))}

        {/* Nodes */}
        {nodes.map(node => (
          <Node key={node.id} node={node} onHover={setHovered} hovered={hovered} />
        ))}
      </svg>

      {/* Legend */}
      <div style={{
        marginTop: 20, display: "flex", gap: 16, flexWrap: "wrap",
        justifyContent: "center", fontSize: 12, color: "#6C757D"
      }}>
        {[
          { color: "#2E86C1", bg: "#E8F4FD", label: "Client" },
          { color: "#27AE60", bg: "#EAFAF1", label: "Service" },
          { color: "#2471A3", bg: "#EBF5FB", label: "Database" },
          { color: "#E74C3C", bg: "#FDEDEC", label: "Cache" },
          { color: "#E67E22", bg: "#FFF3E0", label: "Queue" },
          { color: "#F39C12", bg: "#FEF9E7", label: "Load Balancer" },
        ].map(({ color, bg, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 14, height: 14, borderRadius: 3, background: bg,
              border: `2px solid ${color}`, flexShrink: 0
            }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

---

## Step 5 — Quality Checklist

Before outputting the artifact, verify:

- [ ] Canvas width and height are wide enough — no overlapping nodes
- [ ] Every node has a distinct x,y that doesn't collide with another node (min 20px gap)
- [ ] All edges reference valid node IDs
- [ ] Tier y + height ranges cover all nodes in that tier (nodes should be fully inside their tier zone)
- [ ] Component colors match the palette table
- [ ] Complex diagrams (10+ nodes) use wider canvas (1100–1300px width)
- [ ] The diagram has a title and optional subtitle
- [ ] A legend is shown at the bottom

---

## Step 6 — Sizing Guidelines

| Nodes | Canvas Width | Canvas Height |
|---|---|---|
| 2–5 | 700 | 500 |
| 6–10 | 900 | 650 |
| 11–16 | 1100 | 750 |
| 17+ | 1300 | 900 |

Node size defaults:
- Standard service box: 140 × 60
- Wide service box: 160 × 60
- Database cylinder: 120 × 70
- Horizontal spacing between nodes in same tier: min 20px gap

---

## Common Architecture Patterns (Ready-to-Use Templates)

Reference `references/patterns.md` for pre-built node+edge configurations for:
- Microservices Architecture
- URL Shortener
- Chat Application (WebSocket)
- E-commerce Platform
- Video Streaming (YouTube-like)
- ML Serving Pipeline
- Event-Driven Architecture (Kafka)
- Three-Tier Web App

Use these as starting points and modify per user request.

---

## Handling Follow-up Requests

After generating a diagram, the user may ask:
- "Add a Redis cache" → insert new node in Data Layer, add edge from relevant service
- "Show authentication flow" → add Auth Service node in API Layer
- "Make it more detailed" → expand services, add sub-components
- "画中文版" → translate all labels to Chinese; structure stays the same

Always regenerate the full artifact — do not try to describe changes in prose.
