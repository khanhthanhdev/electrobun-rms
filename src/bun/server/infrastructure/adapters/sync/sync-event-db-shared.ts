import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { getDataDir } from "../../../../db";
import { getActiveSeasonRules } from "../../../domain/season-rules";
import type { SyncRecord } from "./sync-event-db-types";

const seasonTiming = () => getActiveSeasonRules().timing;
export const DEFAULT_MATCH_CYCLE_MS =
  (seasonTiming().defaultCycleTimeSecondsByType.quals ?? 240) * 1000;
export const DEFAULT_MATCH_DURATION_MS =
  seasonTiming().matchDurationSeconds * 1000;

const MATCH_NUMBER_REGEX = /(\d+)(?!.*\d)/;

export const MATCH_STATUS_COMPLETE = new Set([
  "COMPLETE",
  "COMPLETED",
  "FINAL",
  "POSTED",
]);

export const buildSyntheticFmsTeamId = (teamNumber: string): string =>
  `LOCAL_TEAM_${teamNumber}`;

export const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;

  return Boolean(row?.has_table);
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
    throw new Error(`Invalid event code "${eventCode}".`);
  }

  const eventDbPath = join(getDataDir(), `${eventCode}.db`);
  if (!existsSync(eventDbPath)) {
    throw new Error(`Database file for event "${eventCode}" was not found.`);
  }

  const eventDb = new Database(eventDbPath);
  eventDb.exec("PRAGMA busy_timeout = 1000;");

  try {
    return operation(eventDb);
  } finally {
    eventDb.close();
  }
};

export const parseTimestamp = (value: unknown, fallback: number): number => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parsePositiveInteger = (
  value: unknown,
  fallback: number
): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return fallback;
};

export const parseRequiredTeamNumber = (value: unknown): number => {
  const teamNumber = parsePositiveInteger(value, Number.NaN);
  if (!Number.isFinite(teamNumber) || teamNumber <= 0) {
    throw new Error(`Invalid team number "${String(value)}".`);
  }

  return teamNumber;
};

export const toBooleanInt = (value: unknown): number => (value ? 1 : 0);

export const resolveMatchNumber = (
  record: SyncRecord,
  fallback: number
): number => {
  if ("matchNumber" in record) {
    return parsePositiveInteger(record.matchNumber, fallback);
  }

  const matchKey = typeof record.matchKey === "string" ? record.matchKey : "";
  const matchNumberMatch = matchKey.match(MATCH_NUMBER_REGEX);
  if (!matchNumberMatch) {
    return fallback;
  }

  return parsePositiveInteger(matchNumberMatch[1], fallback);
};

export const getExistingEventId = (eventDb: Database): string | null => {
  if (!tableExists(eventDb, "team_ranking")) {
    return null;
  }

  const row = eventDb
    .query(
      "SELECT fms_event_id AS eventId FROM team_ranking WHERE fms_event_id IS NOT NULL AND fms_event_id != '' LIMIT 1"
    )
    .get() as { eventId: string | null } | null;

  return row?.eventId?.trim() || null;
};
