# Automatic Layout, Export, and JSON Schema Design

**Date:** 2026-07-18
**Status:** Approved for implementation planning

## Summary

Diagramcraft will extend its shared diagram pipeline with deterministic automatic layout, clean SVG and PNG export, and a machine-readable JSON Schema. The implementation will preserve every fully positioned diagram as-is, fill only missing positions by default, and offer a reversible force-layout action in the preview.

The three capabilities form one pipeline:

```text
raw diagram -> structural validation -> optional layout -> normalization
            -> shared SVG scene -> interactive preview or clean export
```

The implementation must remain dependency-light, deterministic, non-mutating, accessible, and compatible with the existing architecture and flowchart examples.

## Goals

- Allow diagrams to omit node coordinates and canvas dimensions.
- Preserve existing coordinates unless the user explicitly requests a full relayout.
- Treat architecture tiers as hard layout constraints.
- Produce stable top-to-bottom flowchart layouts, including graphs with feedback edges.
- Export a complete, standalone SVG and a 2x PNG from the current layout.
- Publish the serializable diagram contract as JSON Schema Draft 2020-12.
- Generate runtime validation and JSON Schema from shared contract definitions.
- Keep preview and export rendering on one SVG scene implementation.

## Non-goals

- Interactive drag-and-drop editing.
- Persisting layout changes back to source files or browser storage.
- General-purpose layout quality for very large graphs with hundreds of nodes.
- ELK.js, Dagre, or another layout runtime dependency in this phase.
- PDF export or clipboard integration.
- Exporting hover, focus, selection, toolbars, or other preview-only state.

## Chosen Approach

Implement a small deterministic layered layout engine in the existing diagram module.

This approach fits the current 10-22 node examples, adds no runtime dependency, is straightforward to test, and preserves control over architecture-tier behavior. A future layout adapter may delegate large graphs to ELK.js without changing the public preparation pipeline.

Alternatives considered:

- **ELK.js:** stronger compound-graph and crossing reduction support, but a larger asynchronous dependency than the current project needs.
- **Dagre:** lighter than ELK.js and effective for ordinary DAGs, but hard tier constraints would require a second post-processing system.

## Architecture

### Shared contract

Add `src/diagram/contract.js` as the source of shared enums and field definitions. Runtime validation and schema generation consume this module so their allowed kinds, node types, shapes, anchors, and field requirements cannot silently diverge.

Add `schema/diagram.schema.json` as the checked-in Draft 2020-12 artifact. A deterministic generation script writes the file, while `schema:check` regenerates it in memory and fails when the checked-in version is stale. A standards-compliant validator such as Ajv may be added as a development-only dependency; the browser runtime gains no layout or schema dependency.

JSON Schema handles structural rules. Cross-object semantic rules, such as whether a node references an existing tier, remain in the runtime validator.

### Diagram preparation

Introduce an explicit preparation sequence instead of requiring coordinates before normalization:

1. Validate the raw object structure. Coordinates are optional, but `x` and `y` must occur together.
2. Apply coordinate-independent node presets and size defaults.
3. Apply layout when any node lacks coordinates, or when force mode is requested.
4. Derive or validate scene dimensions and tier bounds.
5. Run overlap and bounds diagnostics on the prepared result.

The main entry point returns a new diagram object and never mutates source datasets.

Suggested public functions:

```js
prepareDiagram(diagram, { layout: "missing" })
layoutDiagram(diagram, { mode: "missing" })
layoutDiagram(diagram, { mode: "force" })
```

`prepareDiagram` is the renderer-facing API. `layoutDiagram` remains independently testable and reusable by tooling.

### Shared SVG scene

Split the current renderer into two responsibilities:

- `DiagramScene` draws tier backgrounds, edges, nodes, markers, and labels.
- `DiagramRenderer` owns interactive preview state, responsive framing, HTML header, HTML legend, and hints.

The export path reuses `DiagramScene` inside a clean SVG document. It adds SVG-native title, subtitle, and legend elements and supplies no hover or selected node. This prevents preview and export from developing separate drawing implementations.

### Export module

Add `src/diagram/export.js` for:

- standalone SVG serialization;
- safe filename generation;
- Blob creation and browser download;
- 2x PNG rasterization through an off-screen canvas;
- cleanup of every temporary object URL;
- readable errors when image decoding, canvas drawing, or Blob generation fails.

The SVG must use explicit presentation attributes or inline styles, system fonts, an opaque white background, a complete `viewBox`, and no `foreignObject` or external asset dependency.

## Data Contract Changes

### Diagram

- `width` and `height` become optional positive numbers.
- Existing `kind`, `title`, `subtitle`, `tiers`, `nodes`, `edges`, `legend`, and `nodeDefaults` remain supported.
- The dimensions describe the graph scene, not the title and legend bands in a complete exported document.
- When dimensions are omitted, preparation derives them from graph content plus scene padding.

### Node

- `x` and `y` become an optional pair.
- Supplying exactly one coordinate is invalid and reports `partial-node-position` at the node path.
- Add optional `tier`, containing a tier ID.
- Architecture nodes participating in tier-constrained automatic layout must reference an existing tier.
- Fully positioned manual diagrams remain valid without `node.tier` unless force layout is requested.

### Tier

- Existing explicit `x`, `y`, `width`, and `height` remain valid for manual layout.
- Automatic layout treats the `tiers` array order as the top-to-bottom semantic order.
- Automatic tier bounds are derived from member node bounds and padding.

### Edges

Existing `from`, `to`, label, dashed, and anchor properties remain compatible. Edges identified as feedback edges receive routing metadata only in the prepared copy; source data is not mutated. Feedback edges use a deterministic outer routing gutter so upward loops do not pass through the main downward flow or get clipped by the scene bounds.

## Layout Behavior

### Modes

`missing` is the default mode:

- If every node has coordinates, return the same layout values.
- If some nodes lack coordinates, treat positioned nodes as fixed anchors.
- Place only missing nodes into the nearest collision-free slots compatible with their rank or tier.
- Expand the canvas when necessary, but do not move a fixed node or shrink the declared canvas.

`force` mode:

- Ignore all input coordinates.
- Recompute every node position, tier bound, and canvas dimension.
- Fit the canvas to the new content with configured minimum dimensions and outer padding.

Both modes must produce identical output for identical input and options.

### Architecture diagrams

- Tiers are hard constraints during automatic layout.
- Nodes are assigned to tiers by `node.tier`.
- Tiers appear in source-array order from top to bottom.
- Nodes are initially ordered by stable source order.
- Two adjacent-layer barycenter sweeps improve within-tier ordering without sacrificing determinism.
- Free slots are filled left to right with stable spacing.
- Tier rectangles are recomputed around their member nodes with label and content padding.
- Unknown or missing required tiers produce validation errors instead of inferred placement.

### Flowcharts

- Layout orientation is top to bottom.
- A deterministic depth-first pass identifies feedback edges. Feedback edges are excluded from rank assignment but remain rendered.
- The remaining acyclic graph receives longest-path ranks.
- Disconnected components are appended in stable source order.
- Adjacent-rank barycenter sweeps reduce crossings while source order breaks ties.
- Branch nodes share a rank and are centered around their incoming or outgoing neighbors where space permits.

### Collision and bounds handling

- Node sizes are resolved before slot placement.
- Fixed nodes reserve their padded bounding boxes.
- Missing nodes search deterministic candidate slots until a collision-free slot is found.
- Scene geometry includes nodes, edge-label bounds, tier backgrounds, feedback-edge gutters, and scene padding.
- The export document uses the scene width and adds separate SVG-native title and legend bands when computing its final height.
- The prepared output runs through `validateLayout`; unexpected overlap or bounds issues are surfaced during development and tests.

## Existing Data Migration

The two architecture examples receive `node.tier` values matching their current visual bands. Their existing coordinates and rendered appearance remain unchanged in default preview mode. The flowchart example requires no tier migration.

Existing explicit tier geometry remains in source data as the manual-layout presentation. Force layout recomputes tier geometry only in the prepared in-memory copy.

## Preview Interaction

Add three primary toolbar actions:

- `自动重排`
- `导出 SVG`
- `导出 PNG`

After force layout, the first control changes to `恢复原布局`. Restoring replaces the prepared override with the original dataset rather than attempting an inverse transformation.

Layout overrides are stored per example for the current page session. Switching tabs preserves each example's current override. Reloading the page restores repository source data. Export always uses the current visible layout.

Actions must be keyboard reachable, expose clear accessible names, and report success or failure without relying on color alone.

## Export Output

Both formats contain:

- title;
- optional subtitle;
- tier backgrounds;
- all nodes and edges;
- the resolved legend;
- an opaque white background.

They exclude:

- product and workspace headers;
- example tabs and export controls;
- hover, focus, and selection styling;
- the interaction hint.

SVG is serialized as a standalone UTF-8 document. Its intrinsic dimensions describe the complete exported document, including the title and legend bands around the graph scene. PNG is rendered at exactly twice those full document dimensions. Filenames preserve safe Unicode, replace whitespace predictably, and remove operating-system-invalid characters.

## JSON Schema Distribution

The repository artifact lives at `schema/diagram.schema.json` and contains a stable `$id` and Draft 2020-12 `$schema` declaration.

Packaging copies the same file into both archives as:

```text
references/diagram.schema.json
```

Repository validation checks that:

- the artifact matches contract generation;
- all three current examples validate;
- a coordinate-free architecture example validates structurally;
- a coordinate-free flowchart example validates structurally;
- known invalid fixtures fail for the intended reasons;
- both packaged skill archives contain the identical schema.

## Error Handling

Runtime validation continues returning structured issues containing `code`, `path`, and `message`.

New expected issue codes include:

- `partial-node-position`;
- `missing-node-tier`;
- `unknown-node-tier`;
- `layout-node-overlap` when a prepared result unexpectedly overlaps;
- `layout-node-out-of-bounds` when a prepared result exceeds its canvas.

Automatic layout must not silently move explicitly positioned nodes in `missing` mode. Export must reject invalid or unprepared diagrams with a readable error. The preview keeps the last valid diagram visible if an export attempt fails.

## Testing Strategy

### Contract and schema tests

- Schema generation is byte-stable.
- Coordinate pair dependencies behave correctly.
- Current and coordinate-free examples validate.
- Runtime cross-object validation catches missing tier references.

### Layout unit tests

- Fully positioned diagrams preserve coordinates.
- Mixed diagrams place only missing nodes.
- Force layout ignores old coordinates.
- Repeated runs are deeply equal.
- Tier order and node membership remain correct.
- Feedback edges do not collapse flowchart ranks.
- Disconnected components remain deterministic.
- Output has no overlaps or out-of-bounds nodes.
- Missing mode expands but does not shrink a fixed canvas.
- Force mode fits the resulting content.

### Renderer and export tests

- Preview still supports mouse, touch, Enter, and Space selection.
- The export scene contains title, subtitle, graph, and legend.
- Export markup omits preview controls and interactive state.
- SVG contains no external asset or `foreignObject` reference.
- Filename sanitization supports Chinese and removes invalid characters.
- PNG requests a canvas at exactly 2x document dimensions.
- Object URLs are revoked on success and failure paths.

### App and browser verification

- Toolbar actions have accessible names and status feedback.
- Force layout and restore work independently for all examples.
- SVG and PNG downloads open independently.
- Desktop and 390px mobile layouts remain usable.
- Browser console has no errors or warnings during tab, layout, restore, selection, and export flows.

## Acceptance Commands

The implementation is complete only after the following succeed:

```sh
npm test
npm run build
npm run package:skills
```

In addition:

- run the official skill validator against both source skill directories;
- run it again against both packaged archives;
- inspect exported SVG and PNG files in a browser;
- complete desktop and 390px mobile browser smoke tests;
- verify `git diff --check` and a clean browser console.

## Risks and Mitigations

- **Complex cycles produce suboptimal layouts:** feedback-edge removal is deterministic and covered with representative loops; a future layout adapter can introduce ELK.js for larger graphs.
- **Schema and runtime validation drift:** shared contract definitions and a generated-artifact check make drift a CI failure.
- **SVG preview and export diverge:** both use `DiagramScene`; only the document wrapper differs.
- **Mixed layout cannot find local space:** deterministic candidate expansion grows the canvas rather than moving fixed nodes.
- **PNG varies with host fonts:** exports use the same system-font stack as the preview and do not promise pixel identity across operating systems.
