# 时序图渲染模式 (Sequence Diagram)

时序图布局：参与者横排，消息纵向时间轴，生命线垂直向下。

## 数据结构

```js
const ACTORS = [
  { id: "client",  label: "Client",   color: "#3B82F6" },
  { id: "server",  label: "Server",   color: "#10B981" },
  { id: "db",      label: "Database", color: "#8B5CF6" },
];

const MESSAGES = [
  { from: "client", to: "server", label: "HTTP Request",  type: "sync"  },
  { from: "server", to: "db",     label: "SQL Query",     type: "sync"  },
  { from: "db",     to: "server", label: "Result Set",    type: "return"},
  { from: "server", to: "client", label: "HTTP Response", type: "return"},
];
```

## 布局规则

- Actor 间距：`ACTOR_GAP = 200px`
- 消息行高：`MSG_HEIGHT = 60px`
- 生命线颜色：`#E2E8F0`（细虚线）
- Actor 头部：圆角矩形 140×48，深色背景白字
- 消息箭头：sync = 实线 →，return = 虚线 -->，async = 开放箭头

## 渲染关键代码

```jsx
// Actor X 坐标
const actorX = (id) => {
  const idx = ACTORS.findIndex(a => a.id === id);
  return 80 + idx * ACTOR_GAP;
};

// 生命线
ACTORS.map(a => (
  <line x1={actorX(a.id)+70} y1={80} x2={actorX(a.id)+70} y2={H-40}
    stroke="#E2E8F0" strokeWidth={1.5} strokeDasharray="4 3" />
))

// 消息
MESSAGES.map((m, i) => {
  const y = 120 + i * MSG_HEIGHT;
  const x1 = actorX(m.from) + 70;
  const x2 = actorX(m.to)   + 70;
  const isReturn = m.type === "return";
  return <>
    <line x1={x1} y1={y} x2={x2} y2={y}
      stroke={isReturn ? "#94A3B8" : "#475569"}
      strokeWidth={isReturn ? 1.2 : 1.8}
      strokeDasharray={isReturn ? "5 3" : ""}
      markerEnd="url(#arr)" />
    <text x={(x1+x2)/2} y={y-8} textAnchor="middle"
      fontSize={11} fill="#475569">{m.label}</text>
  </>;
})
```
