import { orderRanks } from "./graph.js";

export const ARCHITECTURE_LAYOUT = Object.freeze({
  OUTER: 24,
  TIER_LABEL_HEIGHT: 28,
  TIER_BOTTOM_PADDING: 18,
  TIER_GAP: 18,
  NODE_GAP: 20,
  MIN_CONTENT_WIDTH: 672,
});

/**
 * Positions normalized architecture nodes in source-ordered tier bands.
 */
export function layoutArchitecture(diagram) {
  const nodes = diagram.nodes ?? [];
  const edges = diagram.edges ?? [];
  const tiers = diagram.tiers ?? [];
  const {
    OUTER,
    TIER_LABEL_HEIGHT,
    TIER_BOTTOM_PADDING,
    TIER_GAP,
    NODE_GAP,
    MIN_CONTENT_WIDTH,
  } = ARCHITECTURE_LAYOUT;
  const tierIndexes = new Map(tiers.map((tier, index) => [tier.id, index]));
  const ranks = new Map(nodes.map((node) => [node.id, tierIndexes.get(node.tier)]));
  const sweptRanks = orderRanks(nodes, edges, ranks);
  const orderedTiers = tiers.map((_, index) => sweptRanks[index] ?? []);
  const rowWidths = orderedTiers.map((row) => (
    row.reduce((sum, node) => sum + node.width, 0) + Math.max(0, row.length - 1) * NODE_GAP
  ));
  const rowHeights = orderedTiers.map((row) => Math.max(0, ...row.map((node) => node.height)));
  const contentWidth = Math.max(MIN_CONTENT_WIDTH, 0, ...rowWidths);
  const width = OUTER * 2 + contentWidth;
  const positions = new Map();
  let tierY = OUTER;
  const laidOutTiers = tiers.map((tier, tierIndex) => {
    const row = orderedTiers[tierIndex];
    const rowHeight = rowHeights[tierIndex];
    const height = TIER_LABEL_HEIGHT + rowHeight + TIER_BOTTOM_PADDING;
    let x = OUTER + (contentWidth - rowWidths[tierIndex]) / 2;
    row.forEach((node) => {
      positions.set(node.id, {
        x,
        y: tierY + TIER_LABEL_HEIGHT + (rowHeight - node.height) / 2,
      });
      x += node.width + NODE_GAP;
    });
    const result = { ...tier, x: 12, y: tierY, width: width - 24, height };
    tierY += height + TIER_GAP;
    return result;
  });
  const contentBottom = tiers.length === 0 ? OUTER : tierY - TIER_GAP;

  return {
    ...diagram,
    width,
    height: contentBottom + OUTER,
    tiers: laidOutTiers,
    nodes: nodes.map((node) => ({ ...node, ...positions.get(node.id) })),
    edges: edges.map((edge) => ({ ...edge })),
  };
}
