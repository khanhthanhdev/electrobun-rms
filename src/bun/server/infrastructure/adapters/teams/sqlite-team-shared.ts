import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDataDir, getDb, schema } from "../../../../db";
import { ApplicationError } from "../../../application/common/application-error";

export const MAX_TEAM_NUMBER = 99_999;
export const DEFAULT_TEAM_ADVANCEMENT = 0;
export const DEFAULT_TEAM_DIVISION = 1;
export const DEFAULT_INSPIRE_ELIGIBLE = 1;
export const DEFAULT_PROMOTE_ELIGIBLE = 1;
export const DEFAULT_COMPETING = "Y";

export const assertEventExists = (eventCode: string): void => {
  const db = getDb();
  const [eventRow] = db
    .select({ code: schema.events.code })
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();

  if (!eventRow) {
    throw new ApplicationError(`Event "${eventCode}" was not found.`, 404);
  }
};

export const withEventDb = <T>(
  eventCode: string,
  operation: (eventDb: Database) => T
): T => {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);

  if (!existsSync(eventDbPath)) {
    throw new ApplicationError(
      `Database file for event "${eventCode}" was not found.`,
      404
    );
  }

  const eventDb = new Database(eventDbPath);
  try {
    return operation(eventDb);
  } finally {
    eventDb.close();
  }
};

export const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;

  return Boolean(row?.has_table);
};

export const getTableColumns = (
  eventDb: Database,
  tableName: string
): Set<string> => {
  if (!tableExists(eventDb, tableName)) {
    return new Set<string>();
  }

  const rows = eventDb.query(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;

  return new Set(rows.map((row) => row.name));
};

export const ensureTeamsTable = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS teams (
    number INTEGER NOT NULL PRIMARY KEY,
    advancement INTEGER NOT NULL,
    division INTEGER NOT NULL,
    inspire_eligible INTEGER NOT NULL,
    promote_eligible INTEGER NOT NULL,
    competing TEXT NOT NULL
  )`);
};

export const ensureTeamMetadataTable = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS team_metadata (
    team_number INTEGER NOT NULL PRIMARY KEY,
    team_name TEXT NOT NULL DEFAULT '',
    organization_school TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`);

  const columns = getTableColumns(eventDb, "team_metadata");
  const requiredColumns: [name: string, definition: string][] = [
    ["team_name", "TEXT NOT NULL DEFAULT ''"],
    ["organization_school", "TEXT NOT NULL DEFAULT ''"],
    ["city", "TEXT NOT NULL DEFAULT ''"],
    ["country", "TEXT NOT NULL DEFAULT ''"],
    ["updated_at", "INTEGER NOT NULL DEFAULT 0"],
  ];

  for (const [columnName, definition] of requiredColumns) {
    if (!columns.has(columnName)) {
      eventDb.exec(
        `ALTER TABLE team_metadata ADD COLUMN ${columnName} ${definition}`
      );
    }
  }
};

export const assertValidTeamNumber = (teamNumber: number): void => {
  if (
    !Number.isInteger(teamNumber) ||
    teamNumber <= 0 ||
    teamNumber > MAX_TEAM_NUMBER
  ) {
    throw new ApplicationError(
      `Team number must be an integer between 1 and ${MAX_TEAM_NUMBER}.`,
      400
    );
  }
};
