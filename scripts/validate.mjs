import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ARCH_ECOMMERCE,
  ARCH_FLOWCHART_STYLE,
  LOGIN_FLOW,
} from "../examples/diagrams.js";
import { validateLayout } from "../src/diagram/geometry.js";
import { normalizeDiagram, validateDiagram } from "../src/diagram/schema.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKILLS = ["arch-diagram", "flowchart"];
const EXAMPLES = [
  ["examples/arch-ecommerce.jsx", ARCH_ECOMMERCE],
  ["examples/arch-flowchart-style.jsx", ARCH_FLOWCHART_STYLE],
  ["examples/flowchart-login.jsx", LOGIN_FLOW],
];
const errors = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) errors.push(message);
}

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function parseFrontmatter(source, relativePath) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  check(Boolean(match), `${relativePath}: missing YAML frontmatter`);
  if (!match) return {};

  const metadata = {};
  const keys = [];
  for (const line of match[1].split(/\r?\n/)) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    check(separator > 0, `${relativePath}: malformed frontmatter line: ${line}`);
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    keys.push(key);
    metadata[key] = value;
  }

  check(keys.length === 2 && keys.includes("name") && keys.includes("description"),
    `${relativePath}: frontmatter must contain only name and description`);
  check(Boolean(metadata.name), `${relativePath}: name is required`);
  check(Boolean(metadata.description), `${relativePath}: description is required`);
  check((metadata.description || "").length <= 200,
    `${relativePath}: description exceeds Claude's 200-character limit`);
  return metadata;
}

function referencedMarkdown(source) {
  const references = new Set();
  const patterns = [
    /`(references\/[^`\s]+\.md)`/g,
    /\]\((references\/[^)\s]+\.md)\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) references.add(match[1]);
  }
  return [...references];
}

for (const skill of SKILLS) {
  const skillPath = `${skill}/SKILL.md`;
  const source = read(skillPath);
  const metadata = parseFrontmatter(source, skillPath);
  check(metadata.name === skill, `${skillPath}: name must match its folder`);
  check(source.split(/\r?\n/).length < 500, `${skillPath}: keep SKILL.md below 500 lines`);
  for (const reference of referencedMarkdown(source)) {
    check(fs.existsSync(path.join(ROOT, skill, reference)),
      `${skillPath}: missing referenced file ${reference}`);
  }
}

const archSkill = read("arch-diagram/SKILL.md");
const flowSkill = read("flowchart/SKILL.md");
const readme = read("README.md");
const architectureArtifacts = [
  ["README.md", readme],
  ["arch-diagram/SKILL.md", archSkill],
  ["src/diagram/theme.js", read("src/diagram/theme.js")],
];
const canonicalArchitectureTokens = [
  "#EFF6FF", "#3B82F6", "#ECFDF5", "#10B981", "#FFFBEB", "#F59E0B",
  "#6366F1", "#4F46E5", "#F0FDF4", "#16A34A", "#FEF2F2", "#E11D48",
  "#1D4ED8", "#FFF7ED", "#EA580C", "#F8FAFC", "#94A3B8",
];
check(archSkill.includes("Use flowchart for processes"),
  "arch-diagram/SKILL.md: description must defer process diagrams to flowchart");
check(flowSkill.includes("不要用于云架构"),
  "flowchart/SKILL.md: description must defer architecture diagrams to arch-diagram");
check(!archSkill.includes("`Q` cubic"), "arch-diagram/SKILL.md: quadratic/cubic wording regressed");
check(archSkill.includes(" C ${c1x} ${c1y} ${c2x} ${c2y}"),
  "arch-diagram/SKILL.md: cubic Bézier template is missing");
check(readme.includes("rx = 11") && archSkill.includes("rx=11") && flowSkill.includes("rx=11"),
  "shared card radius must remain rx=11 in README and both skills");
check(fs.existsSync(path.join(ROOT, "flowchart/references/flowchart.md")),
  "flowchart core pattern reference is missing");
for (const [relativePath, source] of architectureArtifacts) {
  for (const token of canonicalArchitectureTokens) {
    check(source.includes(token), `${relativePath}: missing canonical architecture token ${token}`);
  }
}

for (const [relativePath, diagram] of EXAMPLES) {
  const source = read(relativePath);
  for (const issue of validateDiagram(diagram)) {
    check(false, `${relativePath}: ${issue.code} at ${issue.path}: ${issue.message}`);
  }
  const normalized = normalizeDiagram(diagram);
  for (const issue of validateLayout(normalized, { padding: 12, gap: 0 })) {
    check(false, `${relativePath}: ${issue.code}: ${issue.message}`);
  }
  check(source.includes("DiagramRenderer"),
    `${relativePath}: example must use the shared DiagramRenderer`);
  check(source.includes('from "./diagrams.js"'),
    `${relativePath}: example must import its shared diagram data`);
  check(source.split(/\r?\n/).length <= 12,
    `${relativePath}: example entry point should stay a thin wrapper`);
  check(/export\s+default\s+function\s+\w+/.test(source),
    `${relativePath}: expected a default-exported React component`);
}

if (errors.length) {
  console.error(`Validation failed: ${errors.length} error(s), ${checks} checks`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validation passed: ${checks} checks across ${SKILLS.length} skills and ${EXAMPLES.length} examples.`);
