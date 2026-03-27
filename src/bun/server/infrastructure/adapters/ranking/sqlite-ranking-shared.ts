import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDataDir, getDb, schema } from "../../../../db";
import { ApplicationError } from "../../../application/common/application-error";

const VALID_TABLE_NAMES = new Set([
  "team",
  "teams",
  "team_metadata",
  "team_ranking",
  "quals",
  "quals_data",
  "quals_results",
]);

const TEAM_NUMBER_FROM_FMS_TEAM_ID_PATTERN = /(\d+)$/;
const SYNTHETIC_FMS_TEAM_ID_PREFIX = "LOCAL_TEAM_";

const assertValidTableName = (tableName: string): void => {
  if (!VALID_TABLE_NAMES.has(tableName)) {
    throw new ApplicationError(`Invalid table name "${tableName}".`, 500);
  }
};

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
  assertValidTableName(tableName);
  const row = eventDb
    .query(
      "SELECT 1 AS hasTable FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { hasTable: number } | null;

  return Boolean(row?.hasTable);
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

export const buildSyntheticFmsTeamId = (teamNumber: number): string =>
  `${SYNTHETIC_FMS_TEAM_ID_PREFIX}${teamNumber}`;

export const parseTeamNumberFromFmsTeamId = (
  fmsTeamId: string
): number | null => {
  const match = fmsTeamId.match(TEAM_NUMBER_FROM_FMS_TEAM_ID_PATTERN);
  if (!match) {
    return null;
  }

  const parsedTeamNumber = Number.parseInt(match[1], 10);
  return Number.isInteger(parsedTeamNumber) ? parsedTeamNumber : null;
};

export const parseNumericValue = (value: number | string | null): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

export const sanitizeTeamNumber = (
  teamNumber: number | null
): number | null => {
  if (typeof teamNumber !== "number") {
    return null;
  }

  return Number.isInteger(teamNumber) && teamNumber > 0 ? teamNumber : null;
};

export const sanitizeTeamName = (name: string | null): string =>
  name?.trim() ?? "";
