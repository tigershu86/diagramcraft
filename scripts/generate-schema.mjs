import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildDiagramSchema } from "./schema.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "schema/diagram.schema.json");
const output = `${JSON.stringify(buildDiagramSchema(), null, 2)}\n`;
const check = process.argv.includes("--check");

if (check) {
  const current = fs.existsSync(outputPath) ? fs.readFileSync(outputPath, "utf8") : null;
  if (current !== output) {
    console.error("JSON Schema is stale. Run npm run schema:generate.");
    process.exit(1);
  }
  console.log("JSON Schema is current.");
} else {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, output);
  console.log("Generated schema/diagram.schema.json.");
}
