import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DEFAULT_APP_IDENTIFIER = "com.electrobun.app";
const DEFAULT_CHANNEL = "dev";
const PROJECT_ROOT_SCHEMA_FILE = join("src", "bun", "db", "schema.ts");

interface VersionInfo {
  channel?: string;
  identifier?: string;
}

const VERSION_INFO_PATH_CANDIDATES = [
  resolve(process.cwd(), "..", "Resources", "version.json"),
  resolve(process.cwd(), "Resources", "version.json"),
  resolve(import.meta.dir, "../../../Resources/version.json"),
  resolve(import.meta.dir, "../../../../Resources/version.json"),
] as const;
let cachedVersionInfo: VersionInfo | null | undefined;
let cachedProjectDataDir: string | null | undefined;

function resolveAppDataRoot(): string {
  if (process.platform === "darwin") {
    return join(homedir(), "Library", "Application Support");
  }

  if (process.platform === "win32") {
    return process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");
  }

  return process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
}

function resolveVersionInfo(): VersionInfo | null {
  if (cachedVersionInfo !== undefined) {
    return cachedVersionInfo;
  }

  for (const path of VERSION_INFO_PATH_CANDIDATES) {
    if (!existsSync(path)) {
      continue;
    }

    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as VersionInfo;
      if (parsed.identifier && parsed.channel) {
        cachedVersionInfo = parsed;
        return cachedVersionInfo;
      }
    } catch {
      // Ignore malformed files and continue fallback chain.
    }
  }

  cachedVersionInfo = null;
  return cachedVersionInfo;
}

function findProjectRoot(startDir: string): string | null {
  let current = resolve(startDir);

  while (true) {
    if (
      existsSync(join(current, "package.json")) &&
      existsSync(join(current, PROJECT_ROOT_SCHEMA_FILE))
    ) {
      return current;
    }

    const parent = resolve(current, "..");
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function resolveProjectDataDir(): string | null {
  if (cachedProjectDataDir !== undefined) {
    return cachedProjectDataDir;
  }

  const projectRoot =
    findProjectRoot(process.cwd()) ?? findProjectRoot(import.meta.dir);

  cachedProjectDataDir = projectRoot ? join(projectRoot, ".data") : null;
  return cachedProjectDataDir;
}

function resolveIdentifier(): string {
  const fromVersionInfo = resolveVersionInfo()?.identifier;
  if (fromVersionInfo) {
    return fromVersionInfo;
  }

  return process.env.ELECTROBUN_APP_IDENTIFIER ?? DEFAULT_APP_IDENTIFIER;
}

function resolveChannel(): string {
  const fromVersionInfo = resolveVersionInfo()?.channel;
  if (fromVersionInfo) {
    return fromVersionInfo;
  }

  return process.env.ELECTROBUN_BUILD_ENV ?? DEFAULT_CHANNEL;
}

export function resolveDataDir(): string {
  const customDataDir = process.env.ELECTROBUN_DATA_DIR;
  if (customDataDir && customDataDir.trim().length > 0) {
    return resolve(customDataDir);
  }

  const projectDataDir = resolveProjectDataDir();
  if (projectDataDir) {
    return projectDataDir;
  }

  const identifier = resolveIdentifier();
  const channel = resolveChannel();

  return join(resolveAppDataRoot(), identifier, channel);
}

export function ensureDataDirExists(): string {
  const dataDir = resolveDataDir();
  mkdirSync(dataDir, { recursive: true });
  return dataDir;
}
