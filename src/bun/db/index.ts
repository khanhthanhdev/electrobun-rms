import { Database } from "bun:sqlite";
import { join } from "node:path";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { ensureDataDirExists } from "./paths";
// biome-ignore lint/performance/noNamespaceImport: required by drizzle.
// biome-ignore lint/style/noExportedImports: intentional re-export.
import * as schema from "./schema";

type AppDb = BunSQLiteDatabase<typeof schema> & { $client: Database };

// Lazy initialization cache - allows tests to reset database between suites
let _sqlite: Database | null = null;
let _db: AppDb | null = null;
let _dataDir: string | null = null;
let _dbPath: string | null = null;

/**
 * Gets or creates the SQLite database connection.
 * Reads ELECTROBUN_DATA_DIR at call time (not module load) for test isolation.
 */
export const getSqlite = (): Database => {
  if (_sqlite) {
    return _sqlite;
  }

  const dataDir = ensureDataDirExists();
  const dbPath = join(dataDir, "server.db");

  _dataDir = dataDir;
  _dbPath = dbPath;
  _sqlite = new Database(dbPath);
  _sqlite.exec("PRAGMA journal_mode = WAL;");
  _sqlite.exec("PRAGMA busy_timeout = 1000;");
  _sqlite.exec("PRAGMA foreign_keys = ON;");

  return _sqlite;
};

/**
 * Gets or creates the drizzle database instance.
 * Reads ELECTROBUN_DATA_DIR at call time (not module load) for test isolation.
 */
export const getDb = (): AppDb => {
  if (_db) {
    return _db;
  }

  const sqlite = getSqlite();
  _db = drizzle(sqlite, { schema });
  return _db;
};

/**
 * Resets the database connection for testing.
 * Closes current connection and clears cache so next getDb()/getSqlite() call
 * re-reads ELECTROBUN_DATA_DIR and creates fresh connection.
 */
export const resetForTest = (): void => {
  if (_sqlite) {
    _sqlite.close();
    _sqlite = null;
  }
  _db = null;
  _dataDir = null;
  _dbPath = null;
};

/**
 * Gets the data directory path.
 * Reads ELECTROBUN_DATA_DIR at call time (not module load) for test isolation.
 */
export const getDataDir = (): string => {
  if (!_dataDir) {
    getSqlite(); // Force initialization
  }
  if (!_dataDir) {
    throw new Error("Data directory was not initialized");
  }
  return _dataDir;
};

/**
 * Legacy proxy export for backward compatibility - lazily resolves the
 * underlying database via the getters above.
 *
 * WARNING: Using this directly at module load time will freeze the database.
 * Prefer getDb() in repository code.
 */
export const db = new Proxy<AppDb>({} as AppDb, {
  get: (_, prop) => getDb()[prop as keyof AppDb],
});

export { schema };
