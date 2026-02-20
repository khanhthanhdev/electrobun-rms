import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
// biome-ignore lint/performance/noNamespaceImport: required by drizzle.
// biome-ignore lint/style/noExportedImports: intentional re-export.
import * as schema from "./schema";

const DB_PATH = "./server.db";

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });

export { DB_PATH, schema, sqlite };
