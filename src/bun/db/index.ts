import { Database } from "bun:sqlite";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { ensureDataDirExists } from "./paths";
// biome-ignore lint/performance/noNamespaceImport: required by drizzle.
// biome-ignore lint/style/noExportedImports: intentional re-export.
import * as schema from "./schema";

const DATA_DIR = ensureDataDirExists();
const DB_PATH = join(DATA_DIR, "server.db");

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

export { DATA_DIR, DB_PATH, schema, sqlite };
