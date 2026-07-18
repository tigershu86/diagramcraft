# diagramcraft

A pair of Claude skills plus a shared React/SVG runtime for architecture diagrams and flowcharts — inspired by ByteByteGo's style and the draw.io skill approach.

## Skills

| Skill | 用途 | 触发词 |
|---|---|---|
| `arch-diagram` | 系统架构图、微服务图、云基础设施 | "画架构图"、"系统设计图"、"帮我画一个…的架构" |
| `flowchart` | 流程图、决策树、时序图、状态机、泳道图 | "画流程图"、"用 Claude 的方式画图"、"flowchart" |

Both skills share the same visual DNA — same color palette, same `rx=11` border radius, same bezier curves — so diagrams from both look like they come from the same design system.

## Install

### Claude.ai (Web / Desktop)

Download the `.skill` files from [Releases](../../releases) and install via **Settings → Skills**.

### Claude Code (CLI)

```bash
# Global (all projects)
git clone https://github.com/tigershu86/diagramcraft ~/.claude/skills/diagramcraft

# Or per-project
git clone https://github.com/tigershu86/diagramcraft .claude/skills/diagramcraft
```

## Visual Design System

Both skills use the same token set:

```
Border radius:   rx = 11 (cards), rx = h/2 (terminals)
Shadow:          drop-shadow(0 1px 3px rgba(15,23,42,0.08))
Active shadow:   drop-shadow(0 5px 14px <color>55)
Bezier curves:   C control-point routing, auto direction
Edge labels:     10px italic, #F1F5F9 pill background
Font:            system-ui, -apple-system, sans-serif
```

Color palette by component type:

| Type | Fill | Accent |
|---|---|---|
| Client / Input | `#EFF6FF` | `#3B82F6` |
| CDN / Edge | `#ECFDF5` | `#10B981` |
| Load Balancer | `#FFFBEB` | `#F59E0B` |
| API Gateway | `#6366F1` (solid) | `#4F46E5` |
| Microservice | `#F0FDF4` | `#16A34A` |
| Database | `#EFF6FF` | `#1D4ED8` |
| Cache | `#FEF2F2` | `#E11D48` |
| Queue | `#FFF7ED` | `#EA580C` |
| External | `#F8FAFC` | `#94A3B8` |

## Examples

See the [`examples/`](./examples) directory for data-driven React entry points:

- `arch-ecommerce.jsx` — Full e-commerce microservices architecture (22 nodes)
- `flowchart-login.jsx` — User login decision flow
- `arch-flowchart-style.jsx` — Architecture diagram rendered in flowchart style

All three examples import the same `DiagramRenderer`; their graph data lives in `examples/diagrams.js`. This makes schema, routing, interaction, accessibility, and visual-token fixes apply to every example at once.

## Automatic layout and export

Architecture data can omit coordinates entirely. For example, this Checkout diagram declares tiers and relationships while leaving placement to the shared runtime:

```js
const checkout = {
  kind: "architecture",
  title: "Checkout",
  tiers: [
    { id: "client", label: "CLIENT" },
    { id: "service", label: "SERVICES" },
    { id: "data", label: "DATA" },
  ],
  nodes: [
    { id: "storefront", label: "Storefront", type: "client", tier: "client" },
    { id: "checkout", label: "Checkout API", type: "gateway", tier: "service" },
    { id: "orders", label: "Orders DB", type: "database", tier: "data" },
  ],
  edges: [
    { from: "storefront", to: "checkout", label: "HTTPS" },
    { from: "checkout", to: "orders", label: "SQL" },
  ],
};
```

Provide `x` and `y` together to preserve a node's manual position; nodes without that pair are laid out automatically. In the preview, **Force layout** rearranges the whole diagram and **Restore manual** returns to the original geometry. The same prepared diagram can be downloaded as standalone SVG or 2× PNG. Machine consumers can validate data against the [Draft 2020-12 diagram schema](./schema/diagram.schema.json) before rendering.

## Development

Install dependencies and open the interactive preview:

```bash
npm install
npm run dev
```

The preview lets you switch between all three datasets and select nodes with mouse, touch, or keyboard. Build it with `npm run build`.

Run the deterministic repository checks before publishing:

```bash
npm test
```

The test suite covers the shared schema, cubic routing, layout diagnostics, accessible SVG rendering, preview surface, skill metadata, reference integrity, and every example graph. Build uploadable archives with:

```bash
npm run package:skills
```

This writes `dist/arch-diagram.skill` and `dist/flowchart.skill`. Each archive contains the complete skill folder at its root, including `SKILL.md` and its references.

## Shared Diagram Schema

Every preview diagram uses one serializable contract:

```js
const diagram = {
  kind: "architecture", // or "flowchart"
  title: "System name",
  subtitle: "Optional context",
  width: 900,
  height: 700,
  tiers: [],
  nodes: [
    { id: "web", label: "Web", type: "client", x: 80, y: 60 },
    { id: "api", label: "API", type: "gateway", x: 80, y: 180 },
  ],
  edges: [{ from: "web", to: "api", label: "HTTPS" }],
  legend: [{ type: "client", label: "Client" }],
};
```

`normalizeDiagram` supplies canonical sizes and shapes, `validateDiagram` catches invalid IDs and edges, `validateLayout` reports overlap or canvas overflow, and `DiagramRenderer` owns the SVG and interaction layer. Skill-generated deliverables remain standalone JSX artifacts; the shared runtime is the repository's development and example surface.

## Inspired by

- [dtl-anthropic-diagram](https://github.com/dingtingli/dtl-anthropic-diagram) — Claude-native diagram style
- [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp) — draw.io skill structure and type semantics
- [ByteByteGo](https://bytebytego.com) — Visual design reference
