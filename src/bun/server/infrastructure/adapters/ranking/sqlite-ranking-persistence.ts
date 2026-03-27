import type { Database } from "bun:sqlite";
import type { TeamRankingRowToPersist } from "../../../application/dtos/ranking";
import { tableExists } from "./sqlite-ranking-shared";

const TEAM_RANKING_TABLE_SQL = `CREATE TABLE IF NOT EXISTS team_ranking (
  fms_event_id TEXT NOT NULL,
  fms_team_id TEXT NOT NULL,
  ranking INTEGER NOT NULL,
  rank_change INTEGER NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  ties INTEGER NOT NULL,
  qualifying_score TEXT NOT NULL,
  points_scored_total REAL NOT NULL,
  points_scored_average TEXT NOT NULL,
  points_scored_average_change INTEGER NOT NULL,
  matches_played INTEGER NOT NULL,
  matches_counted INTEGER NOT NULL,
  disqualified INTEGER NOT NULL,
  sort_order1 TEXT NOT NULL,
  sort_order2 TEXT NOT NULL,
  sort_order3 TEXT NOT NULL,
  sort_order4 TEXT NOT NULL,
  sort_order5 TEXT NOT NULL,
  sort_order6 TEXT NOT NULL,
  modified_on TEXT NOT NULL
)`;

const ensureTeamRankingTable = (eventDb: Database): void => {
  if (!tableExists(eventDb, "team_ranking")) {
    eventDb.exec(TEAM_RANKING_TABLE_SQL);
  }
};

export const replaceStoredQualificationRankingsInEventDb = (
  eventDb: Database,
  rows: TeamRankingRowToPersist[]
): void => {
  ensureTeamRankingTable(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    eventDb.query("DELETE FROM team_ranking").run();

    const insertStatement = eventDb.query(
      `INSERT INTO team_ranking (
        fms_event_id, fms_team_id, ranking, rank_change, wins, losses, ties,
        qualifying_score, points_scored_total, points_scored_average,
        points_scored_average_change, matches_played, matches_counted,
        disqualified, sort_order1, sort_order2, sort_order3, sort_order4,
        sort_order5, sort_order6, modified_on
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const row of rows) {
      insertStatement.run(
        row.fmsEventId,
        row.fmsTeamId,
        row.ranking,
        row.rankChange,
        row.wins,
        row.losses,
        row.ties,
        row.qualifyingScore,
        row.pointsScoredTotal,
        row.pointsScoredAverage,
        row.pointsScoredAverageChange,
        row.matchesPlayed,
        row.matchesCounted,
        row.disqualified,
        row.sortOrder1,
        row.sortOrder2,
        row.sortOrder3,
        row.sortOrder4,
        row.sortOrder5,
        row.sortOrder6,
        row.modifiedOn
      );
    }

    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};
