import type { Database } from "bun:sqlite";
import {
  ensureLineupTable,
  ensureMatchDataTable,
  ensureScheduleWindowTables,
} from "./sync-event-db-match-tables";
import type { MatchType } from "./sync-event-db-types";

interface MatchStorage {
  blockTable?: "blocks" | "practice_blocks";
  blockType?: "practice" | "qualification";
  dataTable: "elims_data" | "practice_data" | "quals_data";
  gameSpecificTable:
    | "elims_game_specific"
    | "practice_game_specific"
    | "quals_game_specific";
  historyTable:
    | "elims_game_specific_history"
    | "practice_game_specific_history"
    | "quals_game_specific_history";
  lineupTable: MatchType;
  matchCodePrefix: "E" | "P" | "Q";
  resultsTable: "elims_results" | "practice_results" | "quals_results";
  scheduleLabel?: "Practice Schedule" | "Qualification Schedule";
  scheduleTable?: "match_schedule" | "practice_match_schedule";
  scheduleType?: 1 | 2;
}

const MATCH_STORAGE_BY_TYPE: Record<MatchType, MatchStorage> = {
  elims: {
    dataTable: "elims_data",
    gameSpecificTable: "elims_game_specific",
    historyTable: "elims_game_specific_history",
    lineupTable: "elims",
    matchCodePrefix: "E",
    resultsTable: "elims_results",
  },
  practice: {
    blockTable: "practice_blocks",
    blockType: "practice",
    dataTable: "practice_data",
    gameSpecificTable: "practice_game_specific",
    historyTable: "practice_game_specific_history",
    lineupTable: "practice",
    matchCodePrefix: "P",
    resultsTable: "practice_results",
    scheduleLabel: "Practice Schedule",
    scheduleTable: "practice_match_schedule",
    scheduleType: 1,
  },
  quals: {
    blockTable: "blocks",
    blockType: "qualification",
    dataTable: "quals_data",
    gameSpecificTable: "quals_game_specific",
    historyTable: "quals_game_specific_history",
    lineupTable: "quals",
    matchCodePrefix: "Q",
    resultsTable: "quals_results",
    scheduleLabel: "Qualification Schedule",
    scheduleTable: "match_schedule",
    scheduleType: 2,
  },
};

export const resolveMatchStorage = (matchType: MatchType): MatchStorage =>
  MATCH_STORAGE_BY_TYPE[matchType];

export const clearScheduleTables = (eventDb: Database): void => {
  ensureLineupTable(eventDb, "practice");
  ensureLineupTable(eventDb, "quals");
  ensureLineupTable(eventDb, "elims");
  ensureMatchDataTable(eventDb, "practice_data");
  ensureMatchDataTable(eventDb, "quals_data");
  ensureMatchDataTable(eventDb, "elims_data");
  ensureScheduleWindowTables(eventDb);

  for (const tableName of [
    "practice",
    "practice_data",
    "practice_match_schedule",
    "practice_blocks",
    "quals",
    "quals_data",
    "match_schedule",
    "blocks",
    "elims",
    "elims_data",
  ]) {
    eventDb.query(`DELETE FROM ${tableName}`).run();
  }
};

export const writeMatchLineupAndData = (
  eventDb: Database,
  matchType: MatchType,
  match: {
    blueTeam: number;
    matchNumber: number;
    redTeam: number;
    scheduledAt: number;
    status: number;
  }
): void => {
  const storage = resolveMatchStorage(matchType);
  ensureLineupTable(eventDb, storage.lineupTable);
  ensureMatchDataTable(eventDb, storage.dataTable);

  eventDb
    .query(`DELETE FROM ${storage.lineupTable} WHERE match = ?`)
    .run(match.matchNumber);
  if (storage.lineupTable === "elims") {
    eventDb
      .query("INSERT INTO elims (match, red, blue) VALUES (?, ?, ?)")
      .run(match.matchNumber, match.redTeam, match.blueTeam);
  } else {
    eventDb
      .query(
        `INSERT INTO ${storage.lineupTable} (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)`
      )
      .run(match.matchNumber, match.redTeam, 0, match.blueTeam, 0);
  }

  eventDb
    .query(`DELETE FROM ${storage.dataTable} WHERE match = ?`)
    .run(match.matchNumber);
  if (storage.dataTable === "elims_data") {
    eventDb
      .query(
        `INSERT INTO elims_data (
          match,
          status,
          randomization,
          start,
          posted_time,
          fms_match_id,
          fms_schedule_detail_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        match.matchNumber,
        match.status,
        0,
        match.scheduledAt,
        0,
        `${storage.matchCodePrefix}${match.matchNumber}`,
        `${storage.matchCodePrefix}_SCHEDULE_${match.matchNumber}`
      );
    return;
  }

  eventDb
    .query(
      `INSERT INTO ${storage.dataTable} (
        match,
        status,
        randomization,
        start,
        schedule_start,
        posted_time,
        fms_match_id,
        fms_schedule_detail_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      match.matchNumber,
      match.status,
      0,
      match.scheduledAt,
      match.scheduledAt,
      0,
      `${storage.matchCodePrefix}${match.matchNumber}`,
      `${storage.matchCodePrefix}_SCHEDULE_${match.matchNumber}`
    );
};
