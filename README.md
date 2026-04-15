# diagramcraft

A pair of Claude skills that bring a consistent visual design language to architecture diagrams and flowcharts — inspired by ByteByteGo's style and the draw.io skill approach.

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

See the [`examples/`](./examples) directory for ready-to-run React JSX artifacts:

- `arch-ecommerce.jsx` — Full e-commerce microservices architecture (22 nodes)
- `flowchart-login.jsx` — User login decision flow
- `arch-flowchart-style.jsx` — Architecture diagram rendered in flowchart style

## Inspired by

- [dtl-anthropic-diagram](https://github.com/dingtingli/dtl-anthropic-diagram) — Claude-native diagram style
- [jgraph/drawio-mcp](https://github.com/jgraph/drawio-mcp) — draw.io skill structure and type semantics
- [ByteByteGo](https://bytebytego.com) — Visual design reference
