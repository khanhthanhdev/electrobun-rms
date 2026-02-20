import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import * as schema from "./schema";

const DB_PATH = "./app-data.db";

const sqlite = new Database(DB_PATH);
sqlite.exec("PRAGMA journal_mode = WAL;");

export const db = drizzle(sqlite, { schema });
export { schema };
