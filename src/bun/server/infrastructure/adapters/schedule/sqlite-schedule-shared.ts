import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDataDir, getDb, schema } from "../../../../db";
import { ApplicationError } from "../../../application/common/application-error";
import type { ScheduleType } from "../../../application/dtos/schedule";
import { getActiveSeasonRules } from "../../../domain/season-rules";

const timingRules = getActiveSeasonRules().timing;

export const DEFAULT_FIELD_COUNT = 2;
export const DEFAULT_MATCH_TIME_SECONDS = timingRules.matchDurationSeconds;
export const DEFAULT_PRACTICE_CYCLE_TIME_SECONDS =
  timingRules.defaultCycleTimeSecondsByType.practice ?? 180;
export const DEFAULT_QUALS_CYCLE_TIME_SECONDS =
  timingRules.defaultCycleTimeSecondsByType.quals ?? 240;
export const DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS =
  timingRules.defaultFieldStartOffsetSecondsByType.quals ?? 15;
export const DEFAULT_QUALS_MATCHES_PER_TEAM = timingRules.defaultMatchesPerTeam;
export const PRACTICE_LABEL = "Practice Schedule";
export const QUALS_LABEL = "Qualification Schedule";
export const ACTIVE_SCHEDULE_TYPE_CONFIG_KEY = "active_schedule_type";
export const QUALS_FIELD_COUNT_CONFIG_KEY = "quals_field_count";
export const QUALS_FIELD_START_OFFSET_CONFIG_KEY =
  "quals_field_start_offset_seconds";
export const QUALS_MATCHES_PER_TEAM_CONFIG_KEY = "quals_matches_per_team";

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

export const loadEventFieldCount = (eventCode: string): number => {
  const db = getDb();
  const [row] = db
    .select({ fields: schema.events.fields })
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();

  return row?.fields ?? DEFAULT_FIELD_COUNT;
};

export const withEventDb = <T>(
  eventCode: string,
  operation: (eventDb: Database) => T
): T => {
  if (
    eventCode.includes("/") ||
    eventCode.includes("\\") ||
    eventCode.includes("..")
  ) {
    throw new ApplicationError(`Invalid event code "${eventCode}".`, 400);
  }

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

export const ensureEventConfigTable = (eventDb: Database): void => {
  eventDb.exec(
    "CREATE TABLE IF NOT EXISTS config (key TEXT NOT NULL PRIMARY KEY, value TEXT)"
  );
};

export const getEventConfigValue = (
  eventDb: Database,
  key: string
): string | null => {
  ensureEventConfigTable(eventDb);
  const row = eventDb
    .query("SELECT value AS value FROM config WHERE key = ? LIMIT 1")
    .get(key) as { value: string | null } | null;
  return row?.value ?? null;
};

export const setEventConfigValue = (
  eventDb: Database,
  key: string,
  value: string
): void => {
  ensureEventConfigTable(eventDb);
  eventDb
    .query(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
};

export const getActiveScheduleType = (
  eventDb: Database
): ScheduleType | null => {
  const value = getEventConfigValue(eventDb, ACTIVE_SCHEDULE_TYPE_CONFIG_KEY);
  return value === "practice" || value === "quals" ? value : null;
};

export const setActiveScheduleType = (
  eventDb: Database,
  value: ScheduleType | null
): void => {
  ensureEventConfigTable(eventDb);
  if (value === null) {
    eventDb
      .query("DELETE FROM config WHERE key = ?")
      .run(ACTIVE_SCHEDULE_TYPE_CONFIG_KEY);
    return;
  }

  setEventConfigValue(eventDb, ACTIVE_SCHEDULE_TYPE_CONFIG_KEY, value);
};

export const parsePositiveIntegerOrNull = (
  value: string | null
): number | null => {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export const parseNonNegativeIntegerOrNull = (
  value: string | null
): number | null => {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
};
