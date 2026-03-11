import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const projectRoot = process.cwd();
const stageRoot = mkdtempSync(join(tmpdir(), "electrobun-build-"));
const electrobunArgs = ["build", ...process.argv.slice(2)];
const directoryLinkType = process.platform === "win32" ? "junction" : "dir";

const stagedDirectories = ["dist", "docs", "node_modules", "src"];
const stagedFiles = [
  "bun.lock",
  "electrobun.config.ts",
  "package.json",
  "tsconfig.json",
];

for (const relativePath of stagedDirectories) {
  const sourcePath = join(projectRoot, relativePath);

  if (!existsSync(sourcePath)) {
    continue;
  }

  const destinationPath = join(stageRoot, relativePath);
  mkdirSync(dirname(destinationPath), { recursive: true });
  symlinkSync(sourcePath, destinationPath, directoryLinkType);
}

for (const relativePath of stagedFiles) {
  const sourcePath = join(projectRoot, relativePath);

  if (!existsSync(sourcePath)) {
    continue;
  }

  const destinationPath = join(stageRoot, relativePath);
  mkdirSync(dirname(destinationPath), { recursive: true });
  cpSync(sourcePath, destinationPath, { dereference: true });
}

const electrobunBin = join(
  stageRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "electrobun.cmd" : "electrobun"
);
const buildResult = spawnSync(electrobunBin, electrobunArgs, {
  cwd: stageRoot,
  stdio: "inherit",
});

if (buildResult.status !== 0) {
  console.error(`Staged Electrobun build failed in ${stageRoot}`);
  process.exit(buildResult.status ?? 1);
}

syncStageOutput("build");
syncStageOutput("artifacts");
rmSync(stageRoot, { force: true, recursive: true });

function syncStageOutput(relativePath: string) {
  const stagedOutputPath = join(stageRoot, relativePath);

  if (!existsSync(stagedOutputPath)) {
    return;
  }

  const projectOutputPath = join(projectRoot, relativePath);
  mkdirSync(projectOutputPath, { recursive: true });

  for (const entry of readdirSync(stagedOutputPath)) {
    const stagedEntryPath = join(stagedOutputPath, entry);
    const projectEntryPath = join(projectOutputPath, entry);

    rmSync(projectEntryPath, { force: true, recursive: true });
    cpSync(stagedEntryPath, projectEntryPath, {
      dereference: true,
      recursive: true,
    });
  }
}
