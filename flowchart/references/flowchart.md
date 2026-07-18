# Flowchart, Decision, State, and Hierarchy Patterns

Use this reference for the four diagram families that share node-and-edge rendering but differ in semantics and layout.

## Selection

| User intent | Pattern | Primary structure |
|---|---|---|
| Steps, workflow, how-to | Flowchart | Directed stages |
| If/else, approval, branching | Decision tree | Binary or bounded branches |
| Lifecycle, transition, retry | State machine | States and labeled transitions |
| Organization, taxonomy, ownership | Hierarchy | Parent-child tree |

## Shared data model

```js
const NODES = [
  { id: "start", label: "Start", type: "terminal", x: 280, y: 40 },
  { id: "work", label: "Process request", type: "process", x: 260, y: 150 },
  { id: "valid", label: "Valid?", type: "decision", x: 280, y: 270 },
  { id: "done", label: "Done", type: "terminal", x: 280, y: 420 },
];

const EDGES = [
  { from: "start", to: "work" },
  { from: "work", to: "valid" },
  { from: "valid", to: "done", label: "Yes" },
];
```

Allowed node types:

- `terminal` — start or end; pill shape
- `process` — action or step; rounded card
- `decision` — condition; diamond
- `data` — input or output; parallelogram
- `sub` — reusable subprocess; double-border card
- `highlight` — successful or important outcome
- `error` — exception or failure handling
- `state` — stable lifecycle state; rounded card with optional entry/exit note

Every edge must reference a real node ID. Keep labels short and use verbs or conditions.

## Flowchart

Default to top-to-bottom. Group parallel steps at the same `y` coordinate and center each row inside the canvas.

```text
Start
  ↓
Input → Validate
          ├─ valid → Process → End
          └─ invalid → Show error ↺
```

Rules:

- Use one start node and one or more explicit outcomes.
- Put the happy path on the main vertical axis.
- Route retries to the side before returning upward; do not draw a reverse edge through intervening nodes.
- Use `sub` only when the subprocess has meaning outside the current chart.

## Decision tree

Place the initial decision at the top. Allocate horizontal space by subtree size, not by immediate child count.

```js
const NODES = [
  { id: "eligible", label: "Eligible?", type: "decision", x: 280, y: 60 },
  { id: "approve", label: "Approve", type: "highlight", x: 120, y: 220 },
  { id: "review", label: "Manual review", type: "process", x: 360, y: 220 },
];

const EDGES = [
  { from: "eligible", to: "approve", label: "Yes" },
  { from: "eligible", to: "review", label: "No" },
];
```

Rules:

- A binary decision normally has exactly two labeled outgoing edges.
- Use concrete labels such as `score ≥ 80`, not generic `Path A`.
- Keep terminal outcomes visually aligned when possible.
- For more than three branches, use a process/card node unless the source is genuinely a multi-way decision.

## State machine

Model stable states as nodes and events or guards as edge labels. A state is not an action; prefer `Awaiting payment` over `Check payment`.

```js
const NODES = [
  { id: "draft", label: "Draft", type: "state", x: 80, y: 160 },
  { id: "active", label: "Active", type: "state", x: 280, y: 160 },
  { id: "closed", label: "Closed", type: "state", x: 480, y: 160 },
];

const EDGES = [
  { from: "draft", to: "active", label: "publish" },
  { from: "active", to: "closed", label: "archive" },
  { from: "active", to: "active", label: "update" },
];
```

Rules:

- Use left-to-right for mostly linear lifecycles; use a compact loop for cyclic systems.
- Label every non-obvious transition with its event and optional guard: `submit [valid]`.
- Render self-transitions as a small loop outside the node.
- Distinguish an error state from a failed transition.

## Hierarchy

Place the root at the top and descendants beneath it. Use one edge direction throughout the diagram.

```js
const NODES = [
  { id: "company", label: "Company", type: "highlight", x: 280, y: 40 },
  { id: "product", label: "Product", type: "process", x: 120, y: 180 },
  { id: "platform", label: "Platform", type: "process", x: 360, y: 180 },
];

const EDGES = [
  { from: "company", to: "product" },
  { from: "company", to: "platform" },
];
```

Rules:

- A child should have one structural parent; use dashed cross-links for secondary relationships.
- Center parents over the span of their descendants.
- Keep sibling spacing consistent and increase vertical gaps for changes in semantic level.
- For more than four levels, consider a left-to-right tree or collapsible groups.

## Routing and labels

Use cubic Bézier curves with control points offset from the selected anchors. Compute the label position from the curve at `t=0.5`; do not assume the midpoint of the two endpoints lies on the curve.

Size label pills from their text:

```js
const labelWidth = Math.max(36, edge.label.length * 6 + 12);
```

Keep at least 20px between node bounds. Before returning the artifact, verify unique IDs, valid edge endpoints, canvas containment, readable labels, and no unintended node overlap.
