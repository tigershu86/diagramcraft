# 泳道图渲染模式 (Swimlane Diagram)

泳道图：多个并排纵向泳道，每条泳道代表一个角色/部门，流程节点在对应泳道内排列。

## 数据结构

```js
const LANES = [
  { id: "user",    label: "用户",     color: "#EFF6FF" },
  { id: "frontend",label: "前端",     color: "#F0FDF4" },
  { id: "backend", label: "后端",     color: "#FFF7ED" },
  { id: "db",      label: "数据库",   color: "#F5F3FF" },
];

// 节点属于哪条泳道
const NODES = [
  { id: "n1", label: "点击下单", lane: "user",     y: 120 },
  { id: "n2", label: "发起请求", lane: "frontend", y: 120 },
  { id: "n3", label: "校验参数", lane: "backend",  y: 120 },
  { id: "n4", label: "写入订单", lane: "db",       y: 120 },
];
```

## 布局规则

- 泳道宽度：`LANE_W = 200px`
- 泳道标题高度：`HEADER_H = 40px`
- 节点在泳道内水平居中：`nodeX = laneIndex * LANE_W + (LANE_W - NODE_W) / 2`
- 泳道间有 1px 分隔线 `#E2E8F0`

## 渲染关键代码

```jsx
// 泳道背景
LANES.map((lane, i) => (
  <rect x={i * LANE_W} y={0} width={LANE_W} height={H}
    fill={lane.color} opacity={0.6} />
))

// 泳道标题
LANES.map((lane, i) => (
  <text x={i * LANE_W + LANE_W/2} y={24}
    textAnchor="middle" fontSize={13} fontWeight={700} fill="#1E293B">
    {lane.label}
  </text>
))

// 分隔线
LANES.slice(1).map((_, i) => (
  <line x1={(i+1)*LANE_W} y1={0} x2={(i+1)*LANE_W} y2={H}
    stroke="#E2E8F0" strokeWidth={1} />
))
```
