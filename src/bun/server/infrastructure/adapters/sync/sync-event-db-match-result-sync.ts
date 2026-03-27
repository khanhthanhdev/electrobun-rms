import type { Database } from "bun:sqlite";
import { syncMatchGameSpecificDetails } from "./sync-event-db-match-game-specific";
import {
  resolveMatchStorage,
  writeMatchLineupAndData,
} from "./sync-event-db-match-persistence";
import {
  resolveAllianceTeams,
  resolveMatchStatus,
  resolveMatchType,
} from "./sync-event-db-match-shared";
import { ensureResultsTable } from "./sync-event-db-match-tables";
import {
  MATCH_STATUS_COMPLETE,
  parsePositiveInteger,
  parseTimestamp,
  resolveMatchNumber,
} from "./sync-event-db-shared";
import type {
  ApplyNotifications,
  MatchPhase,
  MatchType,
  SyncRecord,
} from "./sync-event-db-types";

const resolveMatchResultInput = (
  record: SyncRecord,
  fallbackTimestamp: number
): {
  blueTeam: number;
  matchNumber: number;
  redTeam: number;
  scheduledAt: number;
  status: number;
} => {
  const { blueTeam, redTeam } = resolveAllianceTeams(record);
  const matchNumber = resolveMatchNumber(record, 0);
  if (matchNumber <= 0) {
    throw new Error(
      `Unable to resolve match number for record "${String(record.matchKey)}".`
    );
  }

  const status = resolveMatchStatus(record.status);
  const scheduledAt = parseTimestamp(
    record.playedAt ?? record.scheduledAt,
    fallbackTimestamp
  );

  return { blueTeam, matchNumber, redTeam, scheduledAt, status };
};

const replaceMatchResults = (
  eventDb: Database,
  matchType: MatchType,
  matchNumber: number,
  redScore: number,
  blueScore: number,
  redPenalty: number,
  bluePenalty: number
): void => {
  const { resultsTable } = resolveMatchStorage(matchType);
  ensureResultsTable(eventDb, resultsTable);
  eventDb.query(`DELETE FROM ${resultsTable} WHERE match = ?`).run(matchNumber);
  eventDb
    .query(
      `INSERT INTO ${resultsTable} (
        match,
        red_score,
        blue_score,
        red_penalty_committed,
        blue_penalty_committed
      ) VALUES (?, ?, ?, ?, ?)`
    )
    .run(matchNumber, redScore, blueScore, redPenalty, bluePenalty);
};

const updateMatchDataStatus = (
  eventDb: Database,
  matchType: MatchType,
  matchNumber: number,
  status: number,
  postedTime: number,
  playedAt: number
): void => {
  const { dataTable } = resolveMatchStorage(matchType);
  const updateQuery =
    dataTable === "elims_data"
      ? `UPDATE ${dataTable} SET status = ?, posted_time = ?, start = ? WHERE match = ?`
      : `UPDATE ${dataTable} SET status = ?, posted_time = ?, start = ?, schedule_start = COALESCE(schedule_start, ?) WHERE match = ?`;

  if (dataTable === "elims_data") {
    eventDb.query(updateQuery).run(status, postedTime, playedAt, matchNumber);
    return;
  }

  eventDb
    .query(updateQuery)
    .run(status, postedTime, playedAt, playedAt, matchNumber);
};

export const applyMatchResults = (
  eventDb: Database,
  records: SyncRecord[],
  notifications: ApplyNotifications
): void => {
  const now = Date.now();

  for (const record of records) {
    const phase = String(record.phase ?? "QUALIFICATION") as MatchPhase;
    const matchType = resolveMatchType(phase);
    const playedAt = parseTimestamp(record.playedAt, now);
    const match = resolveMatchResultInput(record, playedAt);
    const postedTime = MATCH_STATUS_COMPLETE.has(
      String(record.status).toUpperCase()
    )
      ? playedAt
      : 0;

    writeMatchLineupAndData(eventDb, matchType, match);
    replaceMatchResults(
      eventDb,
      matchType,
      match.matchNumber,
      parsePositiveInteger(record.redScore, 0),
      parsePositiveInteger(record.blueScore, 0),
      parsePositiveInteger(record.redPenalty, 0),
      parsePositiveInteger(record.bluePenalty, 0)
    );
    updateMatchDataStatus(
      eventDb,
      matchType,
      match.matchNumber,
      match.status,
      postedTime,
      playedAt
    );

    const details =
      record.details && typeof record.details === "object"
        ? (record.details as {
            blueAlliance?: Record<string, unknown>;
            redAlliance?: Record<string, unknown>;
          })
        : null;

    syncMatchGameSpecificDetails(
      eventDb,
      matchType,
      match.matchNumber,
      playedAt,
      details
    );

    notifications.scoringUpdates.push({
      matchNumber: match.matchNumber,
      matchType,
    });
    if (matchType === "quals") {
      notifications.rankingUpdated = true;
    }
  }
};
