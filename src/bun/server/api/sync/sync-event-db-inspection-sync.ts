import type { Database } from "bun:sqlite";
import {
  parsePositiveInteger,
  parseRequiredTeamNumber,
  parseTimestamp,
} from "./sync-event-db-shared";
import type { ApplyNotifications, SyncRecord } from "./sync-event-db-types";

const ensureInspectionTables = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspections (
    team_number INTEGER NOT NULL PRIMARY KEY,
    status TEXT NOT NULL,
    comment TEXT,
    started_at INTEGER,
    finalized_at INTEGER,
    updated_at INTEGER NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    is_override INTEGER NOT NULL DEFAULT 0,
    changed_by TEXT,
    changed_at INTEGER NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_schedule_form (
    id INTEGER NOT NULL,
    str TEXT NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_schedule_items (
    id INTEGER NOT NULL,
    team INTEGER NOT NULL,
    name TEXT NOT NULL,
    station_number INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    total_time INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    year INTEGER NOT NULL
  )`);
};

export const applyInspectionScheduleSnapshot = (
  eventDb: Database,
  records: SyncRecord[]
): void => {
  ensureInspectionTables(eventDb);
  eventDb.query("DELETE FROM inspection_schedule_items").run();
  eventDb.query("DELETE FROM inspection_schedule_form").run();

  const stageIds = new Map<string, number>();
  let nextStageId = 1;

  for (const record of records) {
    const stage = String(record.stage ?? "GENERAL").trim() || "GENERAL";
    if (!stageIds.has(stage)) {
      stageIds.set(stage, nextStageId);
      eventDb
        .query("INSERT INTO inspection_schedule_form (id, str) VALUES (?, ?)")
        .run(nextStageId, stage);
      nextStageId += 1;
    }

    const startsAt = parseTimestamp(record.startsAt, 0);
    const date = startsAt > 0 ? new Date(startsAt) : null;
    const stageId = stageIds.get(stage);

    if (!stageId) {
      continue;
    }

    eventDb
      .query(
        `INSERT INTO inspection_schedule_items (
          id,
          team,
          name,
          station_number,
          start_time,
          total_time,
          month,
          day,
          year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        stageId,
        parseRequiredTeamNumber(record.teamNumber),
        stage,
        parsePositiveInteger(record.stationNumber, 0),
        startsAt,
        parsePositiveInteger(record.durationMinutes, 0),
        date ? date.getUTCMonth() + 1 : 0,
        date ? date.getUTCDate() : 0,
        date ? date.getUTCFullYear() : 0
      );
  }
};

export const applyInspectionResults = (
  eventDb: Database,
  records: SyncRecord[],
  notifications: ApplyNotifications
): void => {
  ensureInspectionTables(eventDb);

  for (const record of records) {
    const teamNumber = parseRequiredTeamNumber(record.teamNumber);
    const nextStatus =
      String(record.status ?? "NOT_STARTED").trim() || "NOT_STARTED";
    const recordedAt = parseTimestamp(record.recordedAt, Date.now());
    const existing = eventDb
      .query(
        `SELECT
          status AS status,
          comment AS comment,
          started_at AS startedAt,
          finalized_at AS finalizedAt
         FROM inspections
         WHERE team_number = ?
         LIMIT 1`
      )
      .get(teamNumber) as {
      comment: string | null;
      finalizedAt: number | null;
      startedAt: number | null;
      status: string | null;
    } | null;

    const previousStatus = existing?.status ?? "NOT_STARTED";
    const comment =
      typeof record.comment === "string"
        ? record.comment
        : (existing?.comment ?? null);
    const startedAt =
      nextStatus === "IN_PROGRESS"
        ? (existing?.startedAt ?? recordedAt)
        : (existing?.startedAt ?? null);
    const finalizedAt =
      nextStatus === "INCOMPLETE" || nextStatus === "PASSED"
        ? recordedAt
        : null;

    eventDb
      .query(
        `INSERT INTO inspections (
          team_number,
          status,
          comment,
          started_at,
          finalized_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(team_number) DO UPDATE SET
          status = excluded.status,
          comment = excluded.comment,
          started_at = excluded.started_at,
          finalized_at = excluded.finalized_at,
          updated_at = excluded.updated_at`
      )
      .run(teamNumber, nextStatus, comment, startedAt, finalizedAt, recordedAt);

    if (
      previousStatus !== nextStatus ||
      comment !== (existing?.comment ?? null)
    ) {
      eventDb
        .query(
          `INSERT INTO inspection_history (
            team_number,
            action,
            old_status,
            new_status,
            is_override,
            changed_by,
            changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          teamNumber,
          "SYNC_IMPORT",
          previousStatus,
          nextStatus,
          0,
          "sync-api",
          recordedAt
        );
    }

    notifications.inspectionTeamNumbers.add(teamNumber);
  }
};
