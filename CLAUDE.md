# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Type

This is a **Claude Skills bundle**, not a conventional application. It ships two skills (`arch-diagram` and `flowchart`) that teach Claude to produce React JSX + inline SVG diagrams in a consistent ByteByteGo-inspired visual language.

There is no build system, no `package.json`, no tests, no linter, and no runtime dependencies in this repo. The `.jsx` files in `examples/` are reference outputs — they are not compiled here; they are meant to render as Claude artifacts in a host environment.

## Layout

```
arch-diagram/
  SKILL.md           — skill definition (YAML frontmatter + body)
  references/        — loaded on demand by the skill (patterns.md)
flowchart/
  SKILL.md
  references/        — sequence.md, swimlane.md
examples/            — finished JSX artifacts that demonstrate the output
```

Each skill is self-contained and installed either as a `.skill` release file (Claude.ai desktop/web via Settings → Skills) or by cloning the repo into `~/.claude/skills/diagramcraft` (global) or `.claude/skills/diagramcraft` (project).

## How the Skills Work

Each `SKILL.md` begins with a YAML frontmatter block — `name` and `description` — where the `description` **is the trigger**. The description lists natural-language phrases (English and Chinese) that cause Claude to activate the skill. When editing a SKILL.md, treat the description as load-bearing: changing it changes when the skill fires.

Both skills follow the same structure: Step 1 (extract intent) → Step 2 (layout plan) → Step 3 (apply visual tokens) → Step 4 (emit JSX artifact) → quality checklist. The body is instructions to Claude, not code Claude will run.

## Visual Design — Two Token Sets, One DNA

The README advertises a unified design system (rx=11 cards, pill-shaped terminals, bezier edges, `#F1F5F9` pill edge-labels, `drop-shadow(0 1px 3px rgba(15,23,42,0.08))`). **The two SKILL.md files currently use different palettes**, and this is intentional:

- `arch-diagram/SKILL.md` uses the **ByteByteGo palette** (`#E8F4FD`/`#2E86C1` for clients, `#EAFAF1`/`#27AE60` for services, etc.), rx=8 rounded rects, cylinder databases, emoji icons, tiered top-to-bottom layout with labelled background zones, and a `#F8F9FA` canvas.
- `flowchart/SKILL.md` uses the **Claude/Slate palette** (`#0F172A` terminals, `#F8FAFC`/`#CBD5E1` process nodes, `#FEF9C3`/`#CA8A04` decisions), rx=10, pill-shaped terminals (rx=h/2), diamond decisions, and bezier `C`-curve edges with `#94A3B8` strokes.

When adding a new node type or tweaking colors, update the palette table in the relevant SKILL.md **and** keep it consistent with any example JSX that references it. The canonical token tables are in README.md (cross-skill summary), `arch-diagram/SKILL.md` Step 3, and `flowchart/SKILL.md` Step 3 — changes should be mirrored.

## JSX Output Contract

Skill outputs are a **single React component file** using only inline SVG — no imports beyond `useState` from React, no external UI libs, no Tailwind. Every diagram defines a `NODES`/`EDGES` (or `DIAGRAM`) data object at the top, then renders it through small helper components (`Node`, `Edge`/`Arrow`, `NodeShape`). Anchor-point math, bezier control points, and arrowhead `<marker>` defs are duplicated between skills rather than shared — keep them matching if you change one.

Hover and selection state is managed with `useState` at the root component. The `flowchart` skill additionally emits a selection ring with an animated `strokeDashoffset`; preserve that behavior when refactoring.

## Adding a New Pattern or Shape

1. Add the pattern to `arch-diagram/references/patterns.md` (for architecture) or `flowchart/references/{flowchart,sequence,swimlane}.md` (for flowcharts). These reference files are the skill's long-tail memory — Claude loads them on demand.
2. If a new node shape is needed, extend the `shape`/`type` switch in the corresponding SKILL.md's rendering template (`NodeShape` in flowchart, `Node` in arch-diagram) and add the token row to the palette table.
3. If useful, add a finished `.jsx` to `examples/` demonstrating the pattern end-to-end.

## Release Artifacts

`.skill` files are git-ignored (see `.gitignore`). They are built by packaging a skill directory (e.g. `arch-diagram/`) and attached to GitHub Releases; users install via Settings → Skills on Claude.ai. Do not commit `.skill` files.

## Conventions

- README is bilingual (English headings, Chinese trigger-phrase table). SKILL.md files mix English and Chinese freely — match the existing language mix rather than normalizing it.
- When updating a palette or size table, update every location (README token summary, SKILL.md palette table, any JSX example that hardcodes the value).
- Do not introduce TypeScript, a bundler, or external React component libraries into the example JSX — artifacts must run in Claude's vanilla artifact sandbox.
