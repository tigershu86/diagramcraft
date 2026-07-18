import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageScript = path.join(root, "scripts/package-skills.sh");
const skills = ["arch-diagram", "flowchart"];

function runPackage(outputDirectory) {
  return spawnSync("bash", [packageScript, outputDirectory], {
    cwd: root,
    encoding: "utf8",
  });
}

function unzip(args, options = {}) {
  return spawnSync("unzip", args, {
    cwd: root,
    ...options,
  });
}

test("skill packages include the source schema and remain clean on repeat runs", () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "diagramcraft package "));
  const outputDirectory = path.join(temporaryRoot, "skill archives");
  const sourceSchema = fs.readFileSync(path.join(root, "schema/diagram.schema.json"));

  try {
    for (let run = 1; run <= 2; run += 1) {
      const result = runPackage(outputDirectory);
      assert.equal(result.status, 0, `package run ${run} failed: ${result.stderr}`);

      for (const skill of skills) {
        const archive = path.join(outputDirectory, `${skill}.skill`);
        const packagedSchema = unzip([
          "-p",
          archive,
          `${skill}/references/diagram.schema.json`,
        ]);
        assert.equal(packagedSchema.status, 0, packagedSchema.stderr.toString());
        assert.deepEqual(packagedSchema.stdout, sourceSchema);

        const listing = unzip(["-Z1", archive], { encoding: "utf8" });
        assert.equal(listing.status, 0, listing.stderr);
        assert.equal(
          listing.stdout.split(/\r?\n/).some((entry) => entry.endsWith(".skill")),
          false,
          `${skill} archive contains a nested .skill archive`,
        );
      }
    }
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("skill packaging rejects an output directory inside a source skill", () => {
  const internalOutput = path.join(
    root,
    "arch-diagram",
    `.package-test-output-${process.pid}-${Date.now()}`,
  );
  const linkRoot = fs.mkdtempSync(path.join(os.tmpdir(), "diagramcraft package link "));
  const linkedOutput = path.join(linkRoot, "linked skill output");
  fs.mkdirSync(internalOutput);
  fs.symlinkSync(internalOutput, linkedOutput, "dir");

  try {
    const outputVariants = [
      internalOutput,
      path.join(internalOutput, "..", path.basename(internalOutput)),
      linkedOutput,
    ];
    for (const outputDirectory of outputVariants) {
      const result = runPackage(outputDirectory);
      assert.notEqual(result.status, 0);
      assert.match(
        `${result.stdout}\n${result.stderr}`,
        /refusing to package skills into source skill directory/i,
      );
    }
    assert.deepEqual(fs.readdirSync(internalOutput), []);
  } finally {
    fs.rmSync(linkRoot, { recursive: true, force: true });
    fs.rmSync(internalOutput, { recursive: true, force: true });
  }
});
