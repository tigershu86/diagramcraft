import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("package declares the Vite-supported Node floor", () => {
  const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(packageJson.engines.node, ">=22.12.0");
});
