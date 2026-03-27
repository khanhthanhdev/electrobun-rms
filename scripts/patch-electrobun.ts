/**
 * Patch electrobun's Updater.ts to fix TypeScript errors.
 *
 * Electrobun ships raw .ts source files. Its Updater.ts calls the deprecated
 * `rmdirSync(path, { recursive: true })` which newer @types/node rejects
 * (TS2554: Expected 1 argument, got 2). We replace `rmdirSync` with `rmSync`
 * in both the import and the call-sites.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const filePath = join(
  import.meta.dir,
  "..",
  "node_modules",
  "electrobun",
  "dist",
  "api",
  "bun",
  "core",
  "Updater.ts"
);

if (!existsSync(filePath)) {
  console.log("electrobun Updater.ts not found, skipping patch");
  process.exit(0);
}

let content = readFileSync(filePath, "utf-8");
const original = content;

// Replace the import symbol: rmdirSync → rmSync
content = content.replace(/\brmdirSync\b/g, "rmSync");

// Add `force: true` to rmSync calls that only have `recursive: true`
content = content.replace(
  /rmSync\(([^,]+),\s*\{\s*recursive:\s*true\s*\}\)/g,
  "rmSync($1, { recursive: true, force: true })"
);

if (content === original) {
  console.log("electrobun Updater.ts already patched or pattern not found");
  process.exit(0);
}

writeFileSync(filePath, content);
console.log("Patched electrobun Updater.ts: rmdirSync → rmSync");
