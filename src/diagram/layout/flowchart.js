import { analyzeGraph, orderRanks } from "./graph.js";

const OUTER = 36;
const COLUMN_GAP = 48;
const ROW_GAP = 64;
const FEEDBACK_GUTTER = 120;
const MIN_MAIN_WIDTH = 568;

/**
 * Positions normalized flowchart nodes in deterministic top-to-bottom ranks.
 */
export function layoutFlowchart(diagram) {
  const nodes = diagram.nodes ?? [];
  const edges = diagram.edges ?? [];
  const { ranks, feedbackEdgeIndexes } = analyzeGraph(nodes, edges);
  const rankOrder = orderRanks(nodes, edges, ranks, feedbackEdgeIndexes);
  const rowWidths = rankOrder.map((rank) => (
    rank.reduce((sum, node) => sum + node.width, 0) + Math.max(0, rank.length - 1) * COLUMN_GAP
  ));
  const mainWidth = rowWidths.reduce((maximum, width) => Math.max(maximum, width), MIN_MAIN_WIDTH);
  const rowHeights = rankOrder.map((rank) => (
    rank.reduce((maximum, node) => Math.max(maximum, node.height), 0)
  ));
  const positions = new Map();
  let y = OUTER;
  rankOrder.forEach((rank, rankIndex) => {
    let x = OUTER + (mainWidth - rowWidths[rankIndex]) / 2;
    rank.forEach((node) => {
      positions.set(node.id, { x, y: y + (rowHeights[rankIndex] - node.height) / 2 });
      x += node.width + COLUMN_GAP;
    });
    y += rowHeights[rankIndex] + ROW_GAP;
  });
  const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, rankOrder.length - 1) * ROW_GAP;
  const hasFeedback = feedbackEdgeIndexes.size > 0;
  const gutterX = OUTER + mainWidth + FEEDBACK_GUTTER / 2;

  return {
    ...diagram,
    width: OUTER * 2 + mainWidth + (hasFeedback ? FEEDBACK_GUTTER : 0),
    height: OUTER * 2 + contentHeight,
    nodes: nodes.map((node) => ({ ...node, ...positions.get(node.id) })),
    edges: edges.map((edge, index) => (
      feedbackEdgeIndexes.has(index) ? { ...edge, route: "feedback", gutterX } : { ...edge }
    )),
  };
}
