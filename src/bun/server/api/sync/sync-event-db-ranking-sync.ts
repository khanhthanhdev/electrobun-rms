import type { Database } from "bun:sqlite";
import {
  buildSyntheticFmsTeamId,
  getExistingEventId,
  parsePositiveInteger,
} from "./sync-event-db-shared";
import type {
  ApplyNotifications,
  EventTeamDirectoryEntry,
  SyncRecord,
} from "./sync-event-db-types";

const formatSortOrderValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(3);
};

export const applyTeamRankingsSnapshot = (
  eventDb: Database,
  eventCode: string,
  teamDirectory: EventTeamDirectoryEntry[],
  records: SyncRecord[],
  notifications: ApplyNotifications
): void => {
  const fmsEventId = getExistingEventId(eventDb) || eventCode;
  const teamIdByNumber = new Map(
    teamDirectory.map((team) => [team.teamNumber, team.fmsTeamId])
  );

  eventDb.query("DELETE FROM team_ranking").run();

  const insert = eventDb.query(
    `INSERT INTO team_ranking (
      fms_event_id,
      fms_team_id,
      ranking,
      rank_change,
      wins,
      losses,
      ties,
      qualifying_score,
      points_scored_total,
      points_scored_average,
      points_scored_average_change,
      matches_played,
      matches_counted,
      disqualified,
      sort_order1,
      sort_order2,
      sort_order3,
      sort_order4,
      sort_order5,
      sort_order6,
      modified_on
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const record of records) {
    const teamNumber = String(record.teamNumber);
    const sortOrders = Array.isArray(record.sortOrders)
      ? (record.sortOrders as number[])
      : [];

    insert.run(
      fmsEventId,
      teamIdByNumber.get(teamNumber) || buildSyntheticFmsTeamId(teamNumber),
      parsePositiveInteger(record.rank, 0),
      parsePositiveInteger(record.rankChange, 0),
      parsePositiveInteger(record.wins, 0),
      parsePositiveInteger(record.losses, 0),
      parsePositiveInteger(record.ties, 0),
      formatSortOrderValue(
        typeof record.qualifyingScore === "number" ? record.qualifyingScore : 0
      ),
      typeof record.pointsScoredTotal === "number"
        ? record.pointsScoredTotal
        : 0,
      formatSortOrderValue(
        typeof record.pointsScoredAverage === "number"
          ? record.pointsScoredAverage
          : 0
      ),
      0,
      parsePositiveInteger(record.matchesPlayed, 0),
      parsePositiveInteger(record.matchesPlayed, 0),
      0,
      formatSortOrderValue(sortOrders[0] ?? record.qualifyingScore ?? 0),
      formatSortOrderValue(sortOrders[1] ?? record.pointsScoredAverage ?? 0),
      formatSortOrderValue(sortOrders[2] ?? record.pointsScoredTotal ?? 0),
      formatSortOrderValue(sortOrders[3] ?? Number(teamNumber)),
      formatSortOrderValue(sortOrders[4] ?? 0),
      formatSortOrderValue(sortOrders[5] ?? 0),
      typeof record.modifiedAt === "string"
        ? record.modifiedAt
        : new Date().toISOString()
    );
  }

  notifications.rankingUpdated = true;
};
