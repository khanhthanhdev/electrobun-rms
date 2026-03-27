import type { Database } from "bun:sqlite";
import type {
  PersistedTeamRankingSnapshot,
  PostedQualificationMatch,
  QualificationRankingItem,
  QualificationRankingSourceFingerprintInput,
  RankingTeam,
} from "../../../application/dtos/ranking";
import {
  buildSyntheticFmsTeamId,
  getTableColumns,
  parseNumericValue,
  parseTeamNumberFromFmsTeamId,
  sanitizeTeamName,
  sanitizeTeamNumber,
  tableExists,
} from "./sqlite-ranking-shared";

interface RankingRow {
  fmsTeamId: string;
  losses: number;
  name: string | null;
  played: number;
  rank: number;
  rankingPoint: number | string;
  teamNumber: number | null;
  ties: number;
  total: number;
  wins: number;
}

interface TeamRow extends RankingTeam {}

interface QualificationFingerprintRow {
  bluePenaltyCommittedSum: number;
  blueScoreSum: number;
  matchCount: number;
  maxPostedTime: number;
  redPenaltyCommittedSum: number;
  redScoreSum: number;
  weightedSignature: number;
}

const upsertTeamRecord = (
  teamsByNumber: Map<number, TeamRow>,
  teamNumber: number,
  partial: Partial<Omit<TeamRow, "teamNumber">>
): void => {
  const existing = teamsByNumber.get(teamNumber);
  teamsByNumber.set(teamNumber, {
    teamNumber,
    fmsTeamId:
      partial.fmsTeamId?.trim() ||
      existing?.fmsTeamId ||
      buildSyntheticFmsTeamId(teamNumber),
    name:
      sanitizeTeamName(partial.name ?? null) ||
      existing?.name ||
      `Team ${teamNumber}`,
  });
};

const seedTeamsFromLegacyTable = (
  eventDb: Database,
  teamsByNumber: Map<number, TeamRow>
): void => {
  if (!tableExists(eventDb, "team")) {
    return;
  }

  const rows = eventDb
    .query(
      `SELECT
        fms_team_id AS fmsTeamId,
        team_number AS teamNumber,
        COALESCE(NULLIF(team_name_long, ''), team_name_short, '') AS name
       FROM team
       ORDER BY team_number ASC`
    )
    .all() as Array<{
    fmsTeamId: string | null;
    name: string | null;
    teamNumber: number | null;
  }>;

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber === null) {
      continue;
    }

    upsertTeamRecord(teamsByNumber, teamNumber, {
      fmsTeamId: row.fmsTeamId?.trim() || buildSyntheticFmsTeamId(teamNumber),
      name: row.name ?? undefined,
    });
  }
};

const seedTeamsFromModernTable = (
  eventDb: Database,
  teamsByNumber: Map<number, TeamRow>
): void => {
  if (!tableExists(eventDb, "teams")) {
    return;
  }

  const rows = eventDb
    .query("SELECT number AS teamNumber FROM teams ORDER BY number ASC")
    .all() as Array<{ teamNumber: number }>;

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber !== null) {
      upsertTeamRecord(teamsByNumber, teamNumber, {});
    }
  }
};

const seedTeamsFromMetadataTable = (
  eventDb: Database,
  teamsByNumber: Map<number, TeamRow>
): void => {
  if (!tableExists(eventDb, "team_metadata")) {
    return;
  }

  const columns = getTableColumns(eventDb, "team_metadata");
  let teamNameExpression = "''";
  if (columns.has("team_name")) {
    teamNameExpression = "team_name";
  } else if (columns.has("short_name")) {
    teamNameExpression = "short_name";
  }
  const rows = eventDb
    .query(
      `SELECT team_number AS teamNumber, ${teamNameExpression} AS teamName
       FROM team_metadata
       ORDER BY team_number ASC`
    )
    .all() as Array<{ teamName: string | null; teamNumber: number | null }>;

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber !== null) {
      upsertTeamRecord(teamsByNumber, teamNumber, {
        name: row.teamName ?? undefined,
      });
    }
  }
};

const seedTeamsFromQualsTable = (
  eventDb: Database,
  teamsByNumber: Map<number, TeamRow>
): void => {
  if (!tableExists(eventDb, "quals")) {
    return;
  }

  const rows = eventDb
    .query(
      "SELECT DISTINCT red AS teamNumber FROM quals UNION SELECT DISTINCT blue AS teamNumber FROM quals"
    )
    .all() as Array<{ teamNumber: number | null }>;

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber !== null) {
      upsertTeamRecord(teamsByNumber, teamNumber, {});
    }
  }
};

const loadRankingTeamsFromSources = (eventDb: Database): RankingTeam[] => {
  const teamsByNumber = new Map<number, TeamRow>();
  seedTeamsFromLegacyTable(eventDb, teamsByNumber);
  seedTeamsFromModernTable(eventDb, teamsByNumber);
  seedTeamsFromMetadataTable(eventDb, teamsByNumber);
  seedTeamsFromQualsTable(eventDb, teamsByNumber);

  return Array.from(teamsByNumber.values()).sort(
    (left, right) => left.teamNumber - right.teamNumber
  );
};

export const loadRankingTeamsFromEventDb = (eventDb: Database): RankingTeam[] =>
  loadRankingTeamsFromSources(eventDb);

export const loadPostedQualificationMatchesFromEventDb = (
  eventDb: Database
): PostedQualificationMatch[] => {
  if (
    !(
      tableExists(eventDb, "quals") &&
      tableExists(eventDb, "quals_data") &&
      tableExists(eventDb, "quals_results")
    )
  ) {
    return [];
  }

  return eventDb
    .query(
      `SELECT
        q.match AS matchNumber,
        q.red AS redTeam,
        q.reds AS redSurrogate,
        q.blue AS blueTeam,
        q.blues AS blueSurrogate,
        qd.posted_time AS postedTime,
        qr.red_score AS redScore,
        qr.blue_score AS blueScore,
        qr.red_penalty_committed AS redPenaltyCommitted,
        qr.blue_penalty_committed AS bluePenaltyCommitted
       FROM quals AS q
       INNER JOIN quals_data AS qd ON qd.match = q.match
       INNER JOIN quals_results AS qr ON qr.match = q.match
       WHERE qd.posted_time > 0`
    )
    .all() as PostedQualificationMatch[];
};

export const loadStoredQualificationRankingsFromEventDb = (
  eventDb: Database
): QualificationRankingItem[] => {
  if (!tableExists(eventDb, "team_ranking")) {
    return [];
  }

  const nameByTeamNumber = new Map(
    loadRankingTeamsFromSources(eventDb).map(
      (team) => [team.teamNumber, team.name] as const
    )
  );
  const query = tableExists(eventDb, "team")
    ? eventDb.query(
        `SELECT
          tr.ranking AS rank,
          tr.fms_team_id AS fmsTeamId,
          t.team_number AS teamNumber,
          COALESCE(NULLIF(t.team_name_long, ''), t.team_name_short, '') AS name,
          tr.qualifying_score AS rankingPoint,
          tr.points_scored_total AS total,
          tr.wins AS wins,
          tr.losses AS losses,
          tr.ties AS ties,
          tr.matches_played AS played
         FROM team_ranking AS tr
         LEFT JOIN team AS t ON t.fms_team_id = tr.fms_team_id
         ORDER BY tr.ranking ASC, t.team_number ASC`
      )
    : eventDb.query(
        `SELECT
          ranking AS rank,
          fms_team_id AS fmsTeamId,
          NULL AS teamNumber,
          NULL AS name,
          qualifying_score AS rankingPoint,
          points_scored_total AS total,
          wins AS wins,
          losses AS losses,
          ties AS ties,
          matches_played AS played
         FROM team_ranking
         ORDER BY ranking ASC`
      );

  return (query.all() as RankingRow[]).map((row) => {
    const teamNumber =
      row.teamNumber ?? parseTeamNumberFromFmsTeamId(row.fmsTeamId) ?? 0;

    return {
      rank: row.rank,
      teamNumber,
      name:
        sanitizeTeamName(row.name) || nameByTeamNumber.get(teamNumber) || "",
      rankingPoint: parseNumericValue(row.rankingPoint),
      total: Number.isFinite(row.total) ? row.total : 0,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      played: row.played,
    };
  });
};

export const loadStoredQualificationRankingSnapshotsFromEventDb = (
  eventDb: Database
): PersistedTeamRankingSnapshot[] => {
  if (!tableExists(eventDb, "team_ranking")) {
    return [];
  }

  return eventDb
    .query(
      `SELECT
        fms_event_id AS fmsEventId,
        fms_team_id AS fmsTeamId,
        ranking AS rank,
        points_scored_average AS pointsScoredAverage
       FROM team_ranking`
    )
    .all() as PersistedTeamRankingSnapshot[];
};

export const loadQualificationRankingSourceFingerprintFromEventDb = (
  eventDb: Database
): QualificationRankingSourceFingerprintInput => {
  const teamCount = loadRankingTeamsFromSources(eventDb).length;
  const lineupsCount = tableExists(eventDb, "quals")
    ? ((
        eventDb.query("SELECT COUNT(*) AS count FROM quals").get() as {
          count: number;
        } | null
      )?.count ?? 0)
    : 0;
  const hasPostedSourceTables =
    tableExists(eventDb, "quals") &&
    tableExists(eventDb, "quals_data") &&
    tableExists(eventDb, "quals_results");

  if (!hasPostedSourceTables) {
    return {
      teamCount,
      lineupsCount,
      hasPostedSourceTables,
      source: {
        matchCount: 0,
        maxPostedTime: 0,
        redScoreSum: 0,
        blueScoreSum: 0,
        redPenaltyCommittedSum: 0,
        bluePenaltyCommittedSum: 0,
        weightedSignature: 0,
      },
    };
  }

  const row = eventDb
    .query(
      `SELECT
        COUNT(*) AS matchCount,
        COALESCE(MAX(qd.posted_time), 0) AS maxPostedTime,
        COALESCE(SUM(qr.red_score), 0) AS redScoreSum,
        COALESCE(SUM(qr.blue_score), 0) AS blueScoreSum,
        COALESCE(SUM(qr.red_penalty_committed), 0) AS redPenaltyCommittedSum,
        COALESCE(SUM(qr.blue_penalty_committed), 0) AS bluePenaltyCommittedSum,
        COALESCE(
          SUM(
            q.match * 131 +
            q.red * 17 +
            q.blue * 19 +
            q.reds * 23 +
            q.blues * 29 +
            qr.red_score * 31 +
            qr.blue_score * 37 +
            qr.red_penalty_committed * 41 +
            qr.blue_penalty_committed * 43 +
            qd.posted_time
          ),
          0
        ) AS weightedSignature
       FROM quals AS q
       INNER JOIN quals_data AS qd ON qd.match = q.match
       INNER JOIN quals_results AS qr ON qr.match = q.match
       WHERE qd.posted_time > 0`
    )
    .get() as QualificationFingerprintRow | null;

  return {
    teamCount,
    lineupsCount,
    hasPostedSourceTables,
    source: row ?? {
      matchCount: 0,
      maxPostedTime: 0,
      redScoreSum: 0,
      blueScoreSum: 0,
      redPenaltyCommittedSum: 0,
      bluePenaltyCommittedSum: 0,
      weightedSignature: 0,
    },
  };
};
