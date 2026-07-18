export const FONT = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

export const TOKENS = {
  canvas: "#FFFFFF",
  page: "#F1F5F9",
  panel: "#F8FAFC",
  border: "#E2E8F0",
  edge: "#94A3B8",
  edgeMuted: "#CBD5E1",
  edgeLabel: "#64748B",
  edgeLabelFill: "#F1F5F9",
  heading: "#0F172A",
  muted: "#64748B",
  accent: "#6366F1",
  accentDark: "#4F46E5",
  radius: 11,
};

export const NODE_STYLES = {
  client: { fill: "#EFF6FF", stroke: "#BFDBFE", accent: "#3B82F6", text: "#1E40AF" },
  cdn: { fill: "#ECFDF5", stroke: "#A7F3D0", accent: "#10B981", text: "#065F46" },
  lb: { fill: "#FFFBEB", stroke: "#FDE68A", accent: "#F59E0B", text: "#92400E" },
  security: { fill: "#FDF4FF", stroke: "#F0ABFC", accent: "#A21CAF", text: "#4A044E" },
  gateway: { fill: "#6366F1", stroke: "#4F46E5", accent: "#4F46E5", text: "#FFFFFF" },
  service: { fill: "#F0FDF4", stroke: "#86EFAC", accent: "#16A34A", text: "#14532D" },
  cache: { fill: "#FEF2F2", stroke: "#FCA5A5", accent: "#E11D48", text: "#991B1B" },
  database: { fill: "#EFF6FF", stroke: "#93C5FD", accent: "#1D4ED8", text: "#1D4ED8" },
  queue: { fill: "#FFF7ED", stroke: "#FED7AA", accent: "#EA580C", text: "#7C2D12" },
  search: { fill: "#FEFCE8", stroke: "#FEF08A", accent: "#CA8A04", text: "#713F12" },
  external: { fill: "#F8FAFC", stroke: "#CBD5E1", accent: "#94A3B8", text: "#475569" },
  terminal: { fill: "#0F172A", stroke: "#0F172A", accent: "#0F172A", text: "#FFFFFF" },
  process: { fill: "#F8FAFC", stroke: "#CBD5E1", accent: "#64748B", text: "#1E293B" },
  decision: { fill: "#FEF9C3", stroke: "#CA8A04", accent: "#CA8A04", text: "#713F12" },
  data: { fill: "#EFF6FF", stroke: "#93C5FD", accent: "#3B82F6", text: "#1E40AF" },
  sub: { fill: "#F0FDF4", stroke: "#86EFAC", accent: "#16A34A", text: "#14532D" },
  state: { fill: "#F5F3FF", stroke: "#C4B5FD", accent: "#7C3AED", text: "#5B21B6" },
  highlight: { fill: "#6366F1", stroke: "#4F46E5", accent: "#4F46E5", text: "#FFFFFF" },
  error: { fill: "#FEF2F2", stroke: "#FCA5A5", accent: "#E11D48", text: "#991B1B" },
};

export function nodeStyle(node) {
  return { ...NODE_STYLES.process, ...NODE_STYLES[node.type], ...node.style };
}
