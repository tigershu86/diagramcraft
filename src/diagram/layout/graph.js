function sourceIndexes(nodes) {
  return new Map(nodes.map((node, index) => [node.id, index]));
}

function knownEdges(nodes, edges) {
  const indexes = sourceIndexes(nodes);
  return edges.map((edge, index) => ({ ...edge, index })).filter((edge) => (
    indexes.has(edge.from) && indexes.has(edge.to)
  ));
}

function orderedInsert(items, value, indexes) {
  const insertAt = items.findIndex((item) => indexes.get(item) > indexes.get(value));
  if (insertAt === -1) items.push(value);
  else items.splice(insertAt, 0, value);
}

/**
 * Finds directed DFS back edges and computes longest-path ranks after removing
 * them, without changing either input collection.
 */
export function analyzeGraph(nodes = [], edges = []) {
  const indexes = sourceIndexes(nodes);
  const graphEdges = knownEdges(nodes, edges);
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  graphEdges.forEach((edge) => outgoing.get(edge.from).push(edge));

  const state = new Map(nodes.map((node) => [node.id, 0]));
  const feedbackEdgeIndexes = new Set();
  const visit = (startId) => {
    state.set(startId, 1);
    const stack = [{ id: startId, edgeIndex: 0 }];
    while (stack.length > 0) {
      const frame = stack.at(-1);
      const edgesFromNode = outgoing.get(frame.id);
      if (frame.edgeIndex >= edgesFromNode.length) {
        state.set(frame.id, 2);
        stack.pop();
        continue;
      }

      const edge = edgesFromNode[frame.edgeIndex];
      frame.edgeIndex += 1;
      const destinationState = state.get(edge.to);
      if (destinationState === 1) feedbackEdgeIndexes.add(edge.index);
      else if (destinationState === 0) {
        state.set(edge.to, 1);
        stack.push({ id: edge.to, edgeIndex: 0 });
      }
    }
  };

  nodes.forEach((node) => {
    if (state.get(node.id) === 0) visit(node.id);
  });

  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const forwardOutgoing = new Map(nodes.map((node) => [node.id, []]));
  graphEdges.forEach((edge) => {
    if (feedbackEdgeIndexes.has(edge.index)) return;
    indegree.set(edge.to, indegree.get(edge.to) + 1);
    forwardOutgoing.get(edge.from).push(edge);
  });

  const ready = [];
  nodes.forEach((node) => {
    if (indegree.get(node.id) === 0) ready.push(node.id);
  });
  const ranks = new Map(nodes.map((node) => [node.id, 0]));
  while (ready.length > 0) {
    const id = ready.shift();
    forwardOutgoing.get(id).forEach((edge) => {
      ranks.set(edge.to, Math.max(ranks.get(edge.to), ranks.get(id) + 1));
      indegree.set(edge.to, indegree.get(edge.to) - 1);
      if (indegree.get(edge.to) === 0) orderedInsert(ready, edge.to, indexes);
    });
  }

  return { feedbackEdgeIndexes, ranks };
}

function positions(rankOrder) {
  const result = new Map();
  rankOrder.forEach((rank, rankIndex) => {
    rank.forEach((id, index) => result.set(id, { rank: rankIndex, index }));
  });
  return result;
}

function barycenter(id, edges, endpoint, rank, nodePositions, ranks, fallback) {
  const adjacentRank = endpoint === "to" ? rank - 1 : rank + 1;
  const neighborIndexes = edges
    .filter((edge) => edge[endpoint] === id)
    .map((edge) => edge[endpoint === "to" ? "from" : "to"])
    .filter((neighbor) => ranks.get(neighbor) === adjacentRank)
    .map((neighbor) => nodePositions.get(neighbor)?.index)
    .filter(Number.isFinite);
  if (neighborIndexes.length === 0) return fallback;
  return neighborIndexes.reduce((sum, index) => sum + index, 0) / neighborIndexes.length;
}

/**
 * Orders each rank by one forward incoming-neighbor sweep then one reverse
 * outgoing-neighbor sweep. Node source index breaks every equal comparison.
 */
export function orderRanks(nodes = [], edges = [], ranks = new Map(), feedbackEdgeIndexes = new Set()) {
  if (nodes.length === 0) return [];

  const indexes = sourceIndexes(nodes);
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const maxRank = nodes.reduce((maximum, node) => (
    Math.max(maximum, ranks.get(node.id) ?? 0)
  ), 0);
  const rankOrder = Array.from({ length: maxRank + 1 }, () => []);
  nodes.forEach((node) => rankOrder[ranks.get(node.id) ?? 0].push(node.id));
  const forwardEdges = knownEdges(nodes, edges).filter((edge) => !feedbackEdgeIndexes.has(edge.index));
  const nodePositions = positions(rankOrder);
  const updateRankPositions = (rank) => {
    rankOrder[rank].forEach((id, index) => nodePositions.set(id, { rank, index }));
  };

  for (let rank = 1; rank < rankOrder.length; rank += 1) {
    rankOrder[rank].sort((left, right) => (
      barycenter(left, forwardEdges, "to", rank, nodePositions, ranks, indexes.get(left))
      - barycenter(right, forwardEdges, "to", rank, nodePositions, ranks, indexes.get(right))
      || indexes.get(left) - indexes.get(right)
    ));
    updateRankPositions(rank);
  }
  for (let rank = rankOrder.length - 2; rank >= 0; rank -= 1) {
    rankOrder[rank].sort((left, right) => (
      barycenter(left, forwardEdges, "from", rank, nodePositions, ranks, indexes.get(left))
      - barycenter(right, forwardEdges, "from", rank, nodePositions, ranks, indexes.get(right))
      || indexes.get(left) - indexes.get(right)
    ));
    updateRankPositions(rank);
  }

  return rankOrder.map((rank) => rank.map((id) => nodesById.get(id)));
}
