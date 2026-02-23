import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../db";
import { ServiceError } from "./manual-event-service";

export interface QualificationRankingItem {
  losses: number;
  name: string;
  played: number;
  rank: number;
  rankingPoint: number;
  teamNumber: number;
  ties: number;
  total: number;
  wins: number;
}

export interface EventQualificationRankingsResponse {
  eventCode: string;
  rankings: QualificationRankingItem[];
}

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

interface TeamRow {
  fmsTeamId: string;
  name: string | null;
  teamNumber: number;
}

interface TeamMetadataRow {
  teamName: string | null;
  teamNumber: number;
}

interface TeamsRow {
  teamNumber: number;
}

interface QualificationLineupRow {
  blueSurrogate: number;
  blueTeam: number;
  matchNumber: number;
  redSurrogate: number;
  redTeam: number;
}

interface PostedQualificationMatchRow extends QualificationLineupRow {
  bluePenaltyCommitted: number;
  blueScore: number;
  postedTime: number;
  redPenaltyCommitted: number;
  redScore: number;
}

interface TeamRankingAccumulator {
  fmsTeamId: string;
  losses: number;
  matchesCounted: number;
  matchesPlayed: number;
  name: string;
  pointsScoredAverage: number;
  pointsScoredTotal: number;
  qualifyingScore: number;
  teamNumber: number;
  ties: number;
  wins: number;
}

interface TeamRankingRowToPersist {
  disqualified: number;
  fmsEventId: string;
  fmsTeamId: string;
  losses: number;
  matchesCounted: number;
  matchesPlayed: number;
  modifiedOn: string;
  pointsScoredAverage: string;
  pointsScoredAverageChange: number;
  pointsScoredTotal: number;
  qualifyingScore: string;
  rankChange: number;
  ranking: number;
  sortOrder1: string;
  sortOrder2: string;
  sortOrder3: string;
  sortOrder4: string;
  sortOrder5: string;
  sortOrder6: string;
  ties: number;
  wins: number;
}

interface ExistingTeamRankingRow {
  fmsEventId: string | null;
  fmsTeamId: string;
  pointsScoredAverage: string | null;
  rank: number;
}

interface RankingSourceFingerprintRow {
  bluePenaltyCommittedSum: number;
  blueScoreSum: number;
  matchCount: number;
  maxPostedTime: number;
  redPenaltyCommittedSum: number;
  redScoreSum: number;
  weightedSignature: number;
}

const TEAM_NUMBER_FROM_FMS_TEAM_ID_PATTERN = /(\d+)$/;
const SYNTHETIC_FMS_TEAM_ID_PREFIX = "LOCAL_TEAM_";

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

const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;

  return Boolean(row?.has_table);
};

const getTableColumns = (eventDb: Database, tableName: string): Set<string> => {
  if (!tableExists(eventDb, tableName)) {
    return new Set<string>();
  }

  const rows = eventDb.query(`PRAGMA table_info(${tableName})`).all() as Array<{
    name: string;
  }>;
  const columns = new Set<string>();
  for (const row of rows) {
    columns.add(row.name);
  }

  return columns;
};

const assertEventExists = (eventCode: string): void => {
  const [eventRow] = db
    .select({ code: schema.events.code })
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();

  if (!eventRow) {
    throw new ServiceError(`Event "${eventCode}" was not found.`, 404);
  }
};

const normalizeEventCode = (eventCode: string): string => {
  const normalizedEventCode = eventCode.trim();
  if (!normalizedEventCode) {
    throw new ServiceError("Event code is required.", 400);
  }

  if (
    normalizedEventCode.includes("/") ||
    normalizedEventCode.includes("\\") ||
    normalizedEventCode.includes("..")
  ) {
    throw new ServiceError(`Invalid event code "${normalizedEventCode}".`, 400);
  }

  return normalizedEventCode;
};

const withEventDb = <T>(
  eventCode: string,
  operation: (eventDb: Database) => T
): T => {
  const eventDbPath = join(DATA_DIR, `${eventCode}.db`);

  if (!existsSync(eventDbPath)) {
    throw new ServiceError(
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

const buildSyntheticFmsTeamId = (teamNumber: number): string =>
  `${SYNTHETIC_FMS_TEAM_ID_PREFIX}${teamNumber}`;

const parseTeamNumberFromFmsTeamId = (fmsTeamId: string): number | null => {
  const match = fmsTeamId.match(TEAM_NUMBER_FROM_FMS_TEAM_ID_PATTERN);
  if (!match) {
    return null;
  }

  const parsedTeamNumber = Number.parseInt(match[1], 10);
  return Number.isInteger(parsedTeamNumber) ? parsedTeamNumber : null;
};

const parseNumericValue = (value: number | string): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsedValue = Number.parseFloat(value);
  return Number.isFinite(parsedValue) ? parsedValue : 0;
};

const sanitizeTeamNumber = (teamNumber: number | null): number | null => {
  if (typeof teamNumber !== "number") {
    return null;
  }

  return Number.isInteger(teamNumber) && teamNumber > 0 ? teamNumber : null;
};

const sanitizeTeamName = (name: string | null): string => name?.trim() ?? "";

const upsertTeamRecord = (
  teamsByNumber: Map<number, TeamRow>,
  teamNumber: number,
  partial: Partial<Omit<TeamRow, "teamNumber">>
): TeamRow => {
  const existing = teamsByNumber.get(teamNumber);
  const nextTeam: TeamRow = existing
    ? {
        ...existing,
        fmsTeamId: partial.fmsTeamId ?? existing.fmsTeamId,
        name: partial.name?.trim() ? partial.name : existing.name,
      }
    : {
        teamNumber,
        fmsTeamId: partial.fmsTeamId ?? buildSyntheticFmsTeamId(teamNumber),
        name: partial.name?.trim() ? partial.name : `Team ${teamNumber}`,
      };

  teamsByNumber.set(teamNumber, nextTeam);
  return nextTeam;
};

const loadTeamsFromLegacyTeamTable = (
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

    const resolvedFmsTeamId = row.fmsTeamId?.trim()
      ? row.fmsTeamId
      : buildSyntheticFmsTeamId(teamNumber);
    upsertTeamRecord(teamsByNumber, teamNumber, {
      fmsTeamId: resolvedFmsTeamId,
      name: sanitizeTeamName(row.name) || `Team ${teamNumber}`,
    });
  }
};

const loadTeamsFromManualTeamsTable = (
  eventDb: Database,
  teamsByNumber: Map<number, TeamRow>
): void => {
  if (!tableExists(eventDb, "teams")) {
    return;
  }

  const rows = eventDb
    .query("SELECT number AS teamNumber FROM teams ORDER BY number ASC")
    .all() as TeamsRow[];

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber === null) {
      continue;
    }

    upsertTeamRecord(teamsByNumber, teamNumber, {});
  }
};

const loadTeamMetadataNames = (
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
      `SELECT
        team_number AS teamNumber,
        ${teamNameExpression} AS teamName
       FROM team_metadata
       ORDER BY team_number ASC`
    )
    .all() as TeamMetadataRow[];

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber === null) {
      continue;
    }

    upsertTeamRecord(teamsByNumber, teamNumber, {
      name: sanitizeTeamName(row.teamName) || `Team ${teamNumber}`,
    });
  }
};

const loadTeamsFromQualificationSchedule = (
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
    .all() as TeamsRow[];

  for (const row of rows) {
    const teamNumber = sanitizeTeamNumber(row.teamNumber);
    if (teamNumber === null) {
      continue;
    }

    upsertTeamRecord(teamsByNumber, teamNumber, {});
  }
};

const loadRankingTeams = (eventDb: Database): TeamRow[] => {
  const teamsByNumber = new Map<number, TeamRow>();
  loadTeamsFromLegacyTeamTable(eventDb, teamsByNumber);
  loadTeamsFromManualTeamsTable(eventDb, teamsByNumber);
  loadTeamMetadataNames(eventDb, teamsByNumber);
  loadTeamsFromQualificationSchedule(eventDb, teamsByNumber);

  return Array.from(teamsByNumber.values()).sort(
    (left, right) => left.teamNumber - right.teamNumber
  );
};

const loadQualificationLineups = (
  eventDb: Database
): QualificationLineupRow[] => {
  if (!tableExists(eventDb, "quals")) {
    return [];
  }

  return eventDb
    .query(
      `SELECT
        match AS matchNumber,
        red AS redTeam,
        reds AS redSurrogate,
        blue AS blueTeam,
        blues AS blueSurrogate
       FROM quals`
    )
    .all() as QualificationLineupRow[];
};

const hasPostedQualificationSourceTables = (eventDb: Database): boolean =>
  tableExists(eventDb, "quals") &&
  tableExists(eventDb, "quals_data") &&
  tableExists(eventDb, "quals_results");

const loadPostedQualificationMatches = (
  eventDb: Database
): PostedQualificationMatchRow[] => {
  if (!hasPostedQualificationSourceTables(eventDb)) {
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
    .all() as PostedQualificationMatchRow[];
};

const createAccumulatorFromTeam = (team: TeamRow): TeamRankingAccumulator => ({
  teamNumber: team.teamNumber,
  fmsTeamId: team.fmsTeamId,
  name: sanitizeTeamName(team.name) || `Team ${team.teamNumber}`,
  wins: 0,
  losses: 0,
  ties: 0,
  matchesPlayed: 0,
  matchesCounted: 0,
  qualifyingScore: 0,
  pointsScoredTotal: 0,
  pointsScoredAverage: 0,
});

const getOrCreateAccumulator = (
  accumulatorsByTeamNumber: Map<number, TeamRankingAccumulator>,
  teamNumber: number
): TeamRankingAccumulator => {
  const existing = accumulatorsByTeamNumber.get(teamNumber);
  if (existing) {
    return existing;
  }

  const created: TeamRankingAccumulator = {
    teamNumber,
    fmsTeamId: buildSyntheticFmsTeamId(teamNumber),
    name: `Team ${teamNumber}`,
    wins: 0,
    losses: 0,
    ties: 0,
    matchesPlayed: 0,
    matchesCounted: 0,
    qualifyingScore: 0,
    pointsScoredTotal: 0,
    pointsScoredAverage: 0,
  };
  accumulatorsByTeamNumber.set(teamNumber, created);
  return created;
};

const seedTeamAccumulators = (
  eventDb: Database
): Map<number, TeamRankingAccumulator> => {
  const rankingTeams = loadRankingTeams(eventDb);
  const accumulatorsByTeamNumber = new Map<number, TeamRankingAccumulator>();

  for (const team of rankingTeams) {
    accumulatorsByTeamNumber.set(
      team.teamNumber,
      createAccumulatorFromTeam(team)
    );
  }

  return accumulatorsByTeamNumber;
};

const applyPostedMatchToAccumulators = (
  accumulatorsByTeamNumber: Map<number, TeamRankingAccumulator>,
  match: PostedQualificationMatchRow
): void => {
  const redAccumulator = getOrCreateAccumulator(
    accumulatorsByTeamNumber,
    match.redTeam
  );
  const blueAccumulator = getOrCreateAccumulator(
    accumulatorsByTeamNumber,
    match.blueTeam
  );

  redAccumulator.matchesPlayed += 1;
  blueAccumulator.matchesPlayed += 1;

  const redCounts = match.redSurrogate === 0;
  const blueCounts = match.blueSurrogate === 0;

  if (redCounts) {
    redAccumulator.matchesCounted += 1;
    redAccumulator.pointsScoredTotal += match.redScore;
  }
  if (blueCounts) {
    blueAccumulator.matchesCounted += 1;
    blueAccumulator.pointsScoredTotal += match.blueScore;
  }

  if (match.redScore === match.blueScore) {
    if (redCounts) {
      redAccumulator.ties += 1;
    }
    if (blueCounts) {
      blueAccumulator.ties += 1;
    }
    return;
  }

  const redWon = match.redScore > match.blueScore;
  if (redCounts) {
    if (redWon) {
      redAccumulator.wins += 1;
    } else {
      redAccumulator.losses += 1;
    }
  }

  if (blueCounts) {
    if (redWon) {
      blueAccumulator.losses += 1;
    } else {
      blueAccumulator.wins += 1;
    }
  }
};

const finalizeTeamAccumulators = (
  accumulatorsByTeamNumber: Map<number, TeamRankingAccumulator>
): TeamRankingAccumulator[] => {
  const accumulators = Array.from(accumulatorsByTeamNumber.values());
  for (const accumulator of accumulators) {
    accumulator.qualifyingScore = accumulator.wins * 2 + accumulator.ties;
    accumulator.pointsScoredAverage =
      accumulator.matchesCounted > 0
        ? accumulator.pointsScoredTotal / accumulator.matchesCounted
        : 0;
  }

  return accumulators;
};

const computeTeamAccumulators = (
  eventDb: Database
): TeamRankingAccumulator[] => {
  const accumulatorsByTeamNumber = seedTeamAccumulators(eventDb);
  const postedMatches = loadPostedQualificationMatches(eventDb);
  for (const match of postedMatches) {
    if (match.postedTime <= 0) {
      continue;
    }

    applyPostedMatchToAccumulators(accumulatorsByTeamNumber, match);
  }

  return finalizeTeamAccumulators(accumulatorsByTeamNumber);
};

const sortAccumulatorsForRanking = (
  accumulators: TeamRankingAccumulator[]
): TeamRankingAccumulator[] =>
  [...accumulators].sort((left, right) => {
    if (left.qualifyingScore !== right.qualifyingScore) {
      return right.qualifyingScore - left.qualifyingScore;
    }

    if (left.pointsScoredAverage !== right.pointsScoredAverage) {
      return right.pointsScoredAverage - left.pointsScoredAverage;
    }

    if (left.pointsScoredTotal !== right.pointsScoredTotal) {
      return right.pointsScoredTotal - left.pointsScoredTotal;
    }

    return left.teamNumber - right.teamNumber;
  });

const formatFixedDecimal = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0.000";
  }

  return value.toFixed(3);
};

const formatSortKey = (value: number, fractionDigits: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return value.toFixed(fractionDigits);
};

const ensureTeamRankingTable = (eventDb: Database): void => {
  eventDb.exec(TEAM_RANKING_TABLE_SQL);
};

const loadExistingTeamRankingRows = (
  eventDb: Database
): ExistingTeamRankingRow[] => {
  ensureTeamRankingTable(eventDb);

  return eventDb
    .query(
      `SELECT
        fms_event_id AS fmsEventId,
        fms_team_id AS fmsTeamId,
        ranking AS rank,
        points_scored_average AS pointsScoredAverage
       FROM team_ranking`
    )
    .all() as ExistingTeamRankingRow[];
};

const mapExistingRankByTeamId = (
  existingRows: ExistingTeamRankingRow[]
): Map<string, number> => {
  const rankByTeamId = new Map<string, number>();
  for (const row of existingRows) {
    if (!row.fmsTeamId?.trim()) {
      continue;
    }

    rankByTeamId.set(row.fmsTeamId, row.rank);
  }

  return rankByTeamId;
};

const mapExistingAverageByTeamId = (
  existingRows: ExistingTeamRankingRow[]
): Map<string, number> => {
  const averageByTeamId = new Map<string, number>();
  for (const row of existingRows) {
    if (!row.fmsTeamId?.trim()) {
      continue;
    }

    const parsedAverage = parseNumericValue(row.pointsScoredAverage ?? "0");
    averageByTeamId.set(row.fmsTeamId, parsedAverage);
  }

  return averageByTeamId;
};

const resolveFmsEventId = (
  eventCode: string,
  existingRows: ExistingTeamRankingRow[]
): string => {
  for (const row of existingRows) {
    if (row.fmsEventId?.trim()) {
      return row.fmsEventId;
    }
  }

  return eventCode;
};

const buildRowsToPersist = (
  eventCode: string,
  sortedAccumulators: TeamRankingAccumulator[],
  existingRows: ExistingTeamRankingRow[]
): TeamRankingRowToPersist[] => {
  const rankByTeamId = mapExistingRankByTeamId(existingRows);
  const averageByTeamId = mapExistingAverageByTeamId(existingRows);
  const fmsEventId = resolveFmsEventId(eventCode, existingRows);
  const modifiedOn = new Date().toISOString();

  return sortedAccumulators.map((accumulator, index) => {
    const ranking = index + 1;
    const previousRank = rankByTeamId.get(accumulator.fmsTeamId);
    const previousAverage = averageByTeamId.get(accumulator.fmsTeamId) ?? 0;
    const averageChange = Math.round(
      (accumulator.pointsScoredAverage - previousAverage) * 1000
    );

    return {
      fmsEventId,
      fmsTeamId: accumulator.fmsTeamId,
      ranking,
      rankChange:
        previousRank === undefined ? 0 : Math.trunc(previousRank - ranking),
      wins: accumulator.wins,
      losses: accumulator.losses,
      ties: accumulator.ties,
      qualifyingScore: String(accumulator.qualifyingScore),
      pointsScoredTotal: accumulator.pointsScoredTotal,
      pointsScoredAverage: formatFixedDecimal(accumulator.pointsScoredAverage),
      pointsScoredAverageChange: averageChange,
      matchesPlayed: accumulator.matchesPlayed,
      matchesCounted: accumulator.matchesCounted,
      disqualified: 0,
      sortOrder1: formatSortKey(accumulator.qualifyingScore, 0),
      sortOrder2: formatSortKey(accumulator.pointsScoredAverage, 3),
      sortOrder3: formatSortKey(accumulator.pointsScoredTotal, 3),
      sortOrder4: String(accumulator.teamNumber).padStart(6, "0"),
      sortOrder5: "0",
      sortOrder6: "0",
      modifiedOn,
    };
  });
};

const persistTeamRankingRows = (
  eventDb: Database,
  rows: TeamRankingRowToPersist[]
): void => {
  ensureTeamRankingTable(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    eventDb.query("DELETE FROM team_ranking").run();

    const insertStatement = eventDb.query(
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

const toQualificationRankingItems = (
  sortedAccumulators: TeamRankingAccumulator[]
): QualificationRankingItem[] =>
  sortedAccumulators.map((accumulator, index) => ({
    rank: index + 1,
    teamNumber: accumulator.teamNumber,
    name: accumulator.name,
    rankingPoint: accumulator.qualifyingScore,
    total: accumulator.pointsScoredTotal,
    wins: accumulator.wins,
    losses: accumulator.losses,
    ties: accumulator.ties,
    played: accumulator.matchesPlayed,
  }));

const listQualificationRankings = (
  eventDb: Database
): QualificationRankingItem[] => {
  if (!tableExists(eventDb, "team_ranking")) {
    return [];
  }

  const nameByTeamNumber = new Map<number, string>();
  for (const team of loadRankingTeams(eventDb)) {
    const normalizedName = sanitizeTeamName(team.name);
    if (!normalizedName) {
      continue;
    }
    nameByTeamNumber.set(team.teamNumber, normalizedName);
  }

  const hasTeamTable = tableExists(eventDb, "team");
  const query = hasTeamTable
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

  const rows = query.all() as RankingRow[];
  return rows.map((row) => {
    const resolvedTeamNumber =
      row.teamNumber ?? parseTeamNumberFromFmsTeamId(row.fmsTeamId) ?? 0;
    const fallbackName =
      resolvedTeamNumber > 0 ? nameByTeamNumber.get(resolvedTeamNumber) : "";

    return {
      rank: row.rank,
      teamNumber: resolvedTeamNumber,
      name: row.name?.trim() || fallbackName || "",
      rankingPoint: parseNumericValue(row.rankingPoint),
      total: Number.isFinite(row.total) ? row.total : 0,
      wins: row.wins,
      losses: row.losses,
      ties: row.ties,
      played: row.played,
    };
  });
};

const recomputeQualificationRankingsForEventDb = (
  eventDb: Database,
  eventCode: string
): QualificationRankingItem[] => {
  const accumulators = computeTeamAccumulators(eventDb);
  const sortedAccumulators = sortAccumulatorsForRanking(accumulators);
  const existingRows = loadExistingTeamRankingRows(eventDb);
  const rowsToPersist = buildRowsToPersist(
    eventCode,
    sortedAccumulators,
    existingRows
  );

  persistTeamRankingRows(eventDb, rowsToPersist);

  return toQualificationRankingItems(sortedAccumulators);
};

export const recomputeEventQualificationRankings = (
  eventCode: string
): EventQualificationRankingsResponse => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);

  const rankings = withEventDb(normalizedEventCode, (eventDb) =>
    recomputeQualificationRankingsForEventDb(eventDb, normalizedEventCode)
  );

  return {
    eventCode: normalizedEventCode,
    rankings,
  };
};

export const getQualificationRankingSourceFingerprint = (
  eventCode: string
): string => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);

  return withEventDb(normalizedEventCode, (eventDb) => {
    const teams = loadRankingTeams(eventDb);
    const lineups = loadQualificationLineups(eventDb);
    if (!hasPostedQualificationSourceTables(eventDb)) {
      return `teams=${teams.length}|lineups=${lineups.length}|matches=0|maxPostedTime=0|scores=0|penalties=0|signature=0`;
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
      .get() as RankingSourceFingerprintRow | null;

    const signature = row ?? {
      matchCount: 0,
      maxPostedTime: 0,
      redScoreSum: 0,
      blueScoreSum: 0,
      redPenaltyCommittedSum: 0,
      bluePenaltyCommittedSum: 0,
      weightedSignature: 0,
    };

    return [
      `teams=${teams.length}`,
      `lineups=${lineups.length}`,
      `matches=${signature.matchCount}`,
      `maxPostedTime=${signature.maxPostedTime}`,
      `redScoreSum=${signature.redScoreSum}`,
      `blueScoreSum=${signature.blueScoreSum}`,
      `redPenaltyCommittedSum=${signature.redPenaltyCommittedSum}`,
      `bluePenaltyCommittedSum=${signature.bluePenaltyCommittedSum}`,
      `signature=${signature.weightedSignature}`,
    ].join("|");
  });
};

export const getEventQualificationRankings = (
  eventCode: string
): EventQualificationRankingsResponse => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);

  const rankings = withEventDb(normalizedEventCode, (eventDb) =>
    listQualificationRankings(eventDb)
  );

  return {
    eventCode: normalizedEventCode,
    rankings,
  };
};
