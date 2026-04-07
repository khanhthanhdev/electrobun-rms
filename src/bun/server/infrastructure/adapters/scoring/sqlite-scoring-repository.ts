import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { getDataDir, getDb, schema } from "../../../../db";
import { ApplicationError } from "../../../application/common/application-error";
import type {
  MatchHistoryEventItem,
  MatchHistoryItem,
  MatchResultItem,
  MatchScoresheet,
  MatchType,
  SaveMatchAllianceScoreInput,
} from "../../../application/dtos/scoring";
import type {
  PersistedAllianceScoreResult,
  ScoringRepository,
} from "../../../application/interfaces/scoring-repository";
import type { ScoreBreakdown } from "../../../domain/season-rules";
import { ensureResultsTable } from "../match/event-db-results-table";

interface ScoreTableConfig {
  gameSpecificHistoryTable:
    | "practice_game_specific_history"
    | "quals_game_specific_history"
    | "elims_game_specific_history";
  gameSpecificTable:
    | "practice_game_specific"
    | "quals_game_specific"
    | "elims_game_specific";
  lineupTable: "practice" | "quals" | "elims";
  resultsTable: "practice_results" | "quals_results" | "elims_results";
}

interface ExistingResultRow {
  bluePenaltyCommitted: number;
  blueScore: number;
  redPenaltyCommitted: number;
  redScore: number;
}

interface TeamMetadataNameRow {
  teamName: string | null;
  teamNumber: number;
}

interface LegacyTeamNameRow {
  teamNameLong: string | null;
  teamNameShort: string | null;
  teamNumber: number;
}

interface TeamNumberRow {
  teamNumber: number;
}

interface LineupColumnExpressions {
  blueSurrogateSelect: string;
  blueTeamSelect: string;
  joinedBlueSurrogateSelect: string;
  joinedBlueTeamSelect: string;
  joinedRedSurrogateSelect: string;
  joinedRedTeamSelect: string;
  redSurrogateSelect: string;
  redTeamSelect: string;
}

interface MatchSubmissionState {
  hasBlueSubmission: boolean;
  hasRedSubmission: boolean;
}

interface MatchSubmissionSummary {
  byMatch: Map<number, MatchSubmissionState>;
  isReliable: boolean;
}

interface GameSpecificSubmissionRow {
  alliance: number;
  matchNumber: number;
}

const RED_ALLIANCE_VALUE = 0;
const BLUE_ALLIANCE_VALUE = 1;
const VALID_TABLE_NAMES = new Set([
  "practice",
  "quals",
  "elims",
  "practice_results",
  "quals_results",
  "elims_results",
  "practice_game_specific",
  "quals_game_specific",
  "elims_game_specific",
  "practice_game_specific_history",
  "quals_game_specific_history",
  "elims_game_specific_history",
  "team",
  "team_metadata",
  "teams",
]);
const GAME_SPECIFIC_REQUIRED_COLUMNS = new Set<string>([
  "match",
  "alliance",
  "a_second_tier_flags",
  "a_first_tier_flags",
  "a_center_flags",
  "b_center_flag_down",
  "b_base_flags_down",
  "c_opponent_backfield_bullets",
  "d_robot_park_state",
  "d_gold_flags_defended",
  "score_a",
  "score_b",
  "score_c",
  "score_d",
  "score_total",
]);
const GAME_SPECIFIC_HISTORY_REQUIRED_COLUMNS = new Set<string>([
  "match",
  "ts",
  "alliance",
  "a_second_tier_flags",
  "a_first_tier_flags",
  "a_center_flags",
  "b_center_flag_down",
  "b_base_flags_down",
  "c_opponent_backfield_bullets",
  "d_robot_park_state",
  "d_gold_flags_defended",
  "score_a",
  "score_b",
  "score_c",
  "score_d",
  "score_total",
]);

const assertValidTableName = (tableName: string): void => {
  if (!VALID_TABLE_NAMES.has(tableName)) {
    throw new ApplicationError(`Invalid table name "${tableName}".`, 500);
  }
};

const assertEventExists = (eventCode: string): void => {
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

const withEventDb = <T>(
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

const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;

  return Boolean(row?.has_table);
};

const getTableColumns = (eventDb: Database, tableName: string): Set<string> => {
  assertValidTableName(tableName);

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

const toNormalizedTeamName = (teamName: string | null | undefined): string =>
  teamName?.trim() ?? "";

const toFallbackTeamName = (teamNumber: number): string => `Team ${teamNumber}`;

const upsertTeamName = (
  teamNamesByNumber: Map<number, string>,
  teamNumber: number,
  teamName: string | null | undefined
): void => {
  const normalizedTeamName = toNormalizedTeamName(teamName);
  if (normalizedTeamName) {
    teamNamesByNumber.set(teamNumber, normalizedTeamName);
    return;
  }

  if (!teamNamesByNumber.has(teamNumber)) {
    teamNamesByNumber.set(teamNumber, toFallbackTeamName(teamNumber));
  }
};

const loadTeamNamesByNumber = (eventDb: Database): Map<number, string> => {
  const teamNamesByNumber = new Map<number, string>();

  if (tableExists(eventDb, "team")) {
    const teamColumns = getTableColumns(eventDb, "team");
    const longNameExpression = teamColumns.has("team_name_long")
      ? "team_name_long"
      : "NULL";
    const shortNameExpression = teamColumns.has("team_name_short")
      ? "team_name_short"
      : "NULL";
    const teamRows = eventDb
      .query(
        `SELECT
          team_number AS teamNumber,
          ${longNameExpression} AS teamNameLong,
          ${shortNameExpression} AS teamNameShort
         FROM team
         ORDER BY team_number ASC`
      )
      .all() as LegacyTeamNameRow[];

    for (const row of teamRows) {
      const preferredName =
        toNormalizedTeamName(row.teamNameLong) || row.teamNameShort;
      upsertTeamName(teamNamesByNumber, row.teamNumber, preferredName);
    }
  }

  if (tableExists(eventDb, "team_metadata")) {
    const metadataColumns = getTableColumns(eventDb, "team_metadata");
    let metadataTeamNameExpression = "''";
    if (metadataColumns.has("team_name")) {
      metadataTeamNameExpression = "team_name";
    } else if (metadataColumns.has("short_name")) {
      metadataTeamNameExpression = "short_name";
    }

    const metadataRows = eventDb
      .query(
        `SELECT
          team_number AS teamNumber,
          ${metadataTeamNameExpression} AS teamName
         FROM team_metadata
         ORDER BY team_number ASC`
      )
      .all() as TeamMetadataNameRow[];

    for (const row of metadataRows) {
      upsertTeamName(teamNamesByNumber, row.teamNumber, row.teamName);
    }
  }

  if (tableExists(eventDb, "teams")) {
    const teamRows = eventDb
      .query("SELECT number AS teamNumber FROM teams ORDER BY number ASC")
      .all() as TeamNumberRow[];

    for (const row of teamRows) {
      upsertTeamName(teamNamesByNumber, row.teamNumber, null);
    }
  }

  return teamNamesByNumber;
};

const resolveTeamName = (
  teamNamesByNumber: Map<number, string>,
  teamNumber: number
): string => {
  const teamName = teamNamesByNumber.get(teamNumber);
  if (teamName) {
    return teamName;
  }

  const fallbackName = toFallbackTeamName(teamNumber);
  teamNamesByNumber.set(teamNumber, fallbackName);
  return fallbackName;
};

const isMissingRequiredTableError = (
  error: unknown,
  tableName: string
): boolean =>
  error instanceof ApplicationError &&
  error.status === 500 &&
  error.message.includes(`"${tableName}"`);

const resolveLineupColumnExpressions = (
  lineupColumns: Set<string>
): LineupColumnExpressions => {
  if (!(lineupColumns.has("red") && lineupColumns.has("blue"))) {
    throw new ApplicationError(
      'Event lineup table is missing required "red" and "blue" columns.',
      500
    );
  }

  return {
    redTeamSelect: "red AS redTeam",
    blueTeamSelect: "blue AS blueTeam",
    redSurrogateSelect: lineupColumns.has("reds")
      ? "reds AS reds"
      : "0 AS reds",
    blueSurrogateSelect: lineupColumns.has("blues")
      ? "blues AS blues"
      : "0 AS blues",
    joinedRedTeamSelect: "l.red AS redTeam",
    joinedBlueTeamSelect: "l.blue AS blueTeam",
    joinedRedSurrogateSelect: lineupColumns.has("reds")
      ? "l.reds AS reds"
      : "0 AS reds",
    joinedBlueSurrogateSelect: lineupColumns.has("blues")
      ? "l.blues AS blues"
      : "0 AS blues",
  };
};

const loadMatchSubmissionState = (
  eventDb: Database,
  tableName:
    | "practice_game_specific"
    | "quals_game_specific"
    | "elims_game_specific"
): MatchSubmissionSummary => {
  const states = new Map<number, MatchSubmissionState>();
  if (!tableExists(eventDb, tableName)) {
    return { byMatch: states, isReliable: false };
  }

  const columns = getTableColumns(eventDb, tableName);
  if (!hasRequiredColumns(columns, GAME_SPECIFIC_REQUIRED_COLUMNS)) {
    return { byMatch: states, isReliable: false };
  }

  const rows = eventDb
    .query(
      `SELECT match AS matchNumber, alliance AS alliance
       FROM ${tableName}`
    )
    .all() as GameSpecificSubmissionRow[];

  for (const row of rows) {
    const existing = states.get(row.matchNumber) ?? {
      hasRedSubmission: false,
      hasBlueSubmission: false,
    };

    if (row.alliance === RED_ALLIANCE_VALUE) {
      existing.hasRedSubmission = true;
    } else if (row.alliance === BLUE_ALLIANCE_VALUE) {
      existing.hasBlueSubmission = true;
    }

    states.set(row.matchNumber, existing);
  }

  return { byMatch: states, isReliable: true };
};

const assertTableExists = (eventDb: Database, tableName: string): void => {
  if (!tableExists(eventDb, tableName)) {
    throw new ApplicationError(
      `Event database is missing required table "${tableName}".`,
      500
    );
  }
};

const hasRequiredColumns = (
  actualColumns: Set<string>,
  requiredColumns: Set<string>
): boolean => {
  for (const requiredColumn of requiredColumns) {
    if (!actualColumns.has(requiredColumn)) {
      return false;
    }
  }

  return true;
};

const createGameSpecificTableSql = (
  tableName:
    | "practice_game_specific"
    | "quals_game_specific"
    | "elims_game_specific"
): string => `CREATE TABLE IF NOT EXISTS ${tableName} (
  match INTEGER NOT NULL,
  alliance INTEGER NOT NULL,
  a_second_tier_flags INTEGER NOT NULL,
  a_first_tier_flags INTEGER NOT NULL,
  a_center_flags INTEGER NOT NULL,
  b_center_flag_down INTEGER NOT NULL,
  b_base_flags_down INTEGER NOT NULL,
  c_opponent_backfield_bullets INTEGER NOT NULL,
  d_robot_park_state INTEGER NOT NULL,
  d_gold_flags_defended INTEGER NOT NULL,
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  score_c INTEGER NOT NULL,
  score_d INTEGER NOT NULL,
  score_total INTEGER NOT NULL,
  UNIQUE(match, alliance)
)`;

const createGameSpecificHistoryTableSql = (
  tableName:
    | "practice_game_specific_history"
    | "quals_game_specific_history"
    | "elims_game_specific_history"
): string => `CREATE TABLE IF NOT EXISTS ${tableName} (
  match INTEGER NOT NULL,
  ts INTEGER NOT NULL,
  alliance INTEGER NOT NULL,
  a_second_tier_flags INTEGER NOT NULL,
  a_first_tier_flags INTEGER NOT NULL,
  a_center_flags INTEGER NOT NULL,
  b_center_flag_down INTEGER NOT NULL,
  b_base_flags_down INTEGER NOT NULL,
  c_opponent_backfield_bullets INTEGER NOT NULL,
  d_robot_park_state INTEGER NOT NULL,
  d_gold_flags_defended INTEGER NOT NULL,
  score_a INTEGER NOT NULL,
  score_b INTEGER NOT NULL,
  score_c INTEGER NOT NULL,
  score_d INTEGER NOT NULL,
  score_total INTEGER NOT NULL
)`;

const backupAndDropTable = (eventDb: Database, tableName: string): void => {
  assertValidTableName(tableName);

  if (!tableExists(eventDb, tableName)) {
    return;
  }

  const backupName = `${tableName}_backup_${Date.now()}`;
  eventDb.exec(`ALTER TABLE ${tableName} RENAME TO ${backupName}`);
};

const ensureCurrentGameSpecificTable = (
  eventDb: Database,
  tableName:
    | "practice_game_specific"
    | "quals_game_specific"
    | "elims_game_specific"
): void => {
  const tableColumns = getTableColumns(eventDb, tableName);
  if (
    tableColumns.size > 0 &&
    hasRequiredColumns(tableColumns, GAME_SPECIFIC_REQUIRED_COLUMNS)
  ) {
    return;
  }

  backupAndDropTable(eventDb, tableName);
  eventDb.exec(createGameSpecificTableSql(tableName));
};

const ensureGameSpecificHistoryTable = (
  eventDb: Database,
  tableName:
    | "practice_game_specific_history"
    | "quals_game_specific_history"
    | "elims_game_specific_history"
): void => {
  const tableColumns = getTableColumns(eventDb, tableName);
  if (
    tableColumns.size > 0 &&
    hasRequiredColumns(tableColumns, GAME_SPECIFIC_HISTORY_REQUIRED_COLUMNS)
  ) {
    return;
  }

  backupAndDropTable(eventDb, tableName);
  eventDb.exec(createGameSpecificHistoryTableSql(tableName));
};

const ensureScoringSchema = (
  eventDb: Database,
  tables: ScoreTableConfig
): void => {
  ensureCurrentGameSpecificTable(eventDb, tables.gameSpecificTable);
  ensureGameSpecificHistoryTable(eventDb, tables.gameSpecificHistoryTable);
};

const resolveScoreTableConfig = (matchType: MatchType): ScoreTableConfig => {
  if (matchType === "practice") {
    return {
      lineupTable: "practice",
      resultsTable: "practice_results",
      gameSpecificTable: "practice_game_specific",
      gameSpecificHistoryTable: "practice_game_specific_history",
    };
  }

  if (matchType === "quals") {
    return {
      lineupTable: "quals",
      resultsTable: "quals_results",
      gameSpecificTable: "quals_game_specific",
      gameSpecificHistoryTable: "quals_game_specific_history",
    };
  }

  return {
    lineupTable: "elims",
    resultsTable: "elims_results",
    gameSpecificTable: "elims_game_specific",
    gameSpecificHistoryTable: "elims_game_specific_history",
  };
};

const getAllianceValue = (alliance: "red" | "blue"): number =>
  alliance === "red" ? RED_ALLIANCE_VALUE : BLUE_ALLIANCE_VALUE;

const assertMatchExists = (
  eventDb: Database,
  lineupTable: "practice" | "quals" | "elims",
  matchNumber: number
): void => {
  const row = eventDb
    .query(`SELECT 1 AS has_match FROM ${lineupTable} WHERE match = ? LIMIT 1`)
    .get(matchNumber) as { has_match: number } | null;

  if (!row?.has_match) {
    throw new ApplicationError(
      `Match ${matchNumber} does not exist in ${lineupTable}.`,
      404
    );
  }
};

const loadExistingResultRow = (
  eventDb: Database,
  resultsTable: "practice_results" | "quals_results" | "elims_results",
  matchNumber: number
): ExistingResultRow | null =>
  eventDb
    .query(
      `SELECT red_score AS redScore, blue_score AS blueScore, red_penalty_committed AS redPenaltyCommitted, blue_penalty_committed AS bluePenaltyCommitted FROM ${resultsTable} WHERE match = ? LIMIT 1`
    )
    .get(matchNumber) as ExistingResultRow | null;

const persistCurrentGameSpecificRow = (
  eventDb: Database,
  tableName:
    | "practice_game_specific"
    | "quals_game_specific"
    | "elims_game_specific",
  matchNumber: number,
  alliance: number,
  input: SaveMatchAllianceScoreInput,
  scoreBreakdown: ScoreBreakdown
): void => {
  eventDb
    .query(`DELETE FROM ${tableName} WHERE match = ? AND alliance = ?`)
    .run(matchNumber, alliance);

  eventDb
    .query(
      `INSERT INTO ${tableName} (
        match,
        alliance,
        a_second_tier_flags,
        a_first_tier_flags,
        a_center_flags,
        b_center_flag_down,
        b_base_flags_down,
        c_opponent_backfield_bullets,
        d_robot_park_state,
        d_gold_flags_defended,
        score_a,
        score_b,
        score_c,
        score_d,
        score_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      matchNumber,
      alliance,
      input.aSecondTierFlags,
      input.aFirstTierFlags,
      input.aCenterFlags,
      input.bCenterFlagDown,
      input.bBaseFlagsDown,
      input.cOpponentBackfieldBullets,
      input.dRobotParkState,
      input.dGoldFlagsDefended,
      scoreBreakdown.scoreA,
      scoreBreakdown.scoreB,
      scoreBreakdown.scoreC,
      scoreBreakdown.scoreD,
      scoreBreakdown.scoreTotal
    );
};

const persistGameSpecificHistoryRow = (
  eventDb: Database,
  tableName:
    | "practice_game_specific_history"
    | "quals_game_specific_history"
    | "elims_game_specific_history",
  timestamp: number,
  matchNumber: number,
  alliance: number,
  input: SaveMatchAllianceScoreInput,
  scoreBreakdown: ScoreBreakdown
): void => {
  eventDb
    .query(
      `INSERT INTO ${tableName} (
        match,
        ts,
        alliance,
        a_second_tier_flags,
        a_first_tier_flags,
        a_center_flags,
        b_center_flag_down,
        b_base_flags_down,
        c_opponent_backfield_bullets,
        d_robot_park_state,
        d_gold_flags_defended,
        score_a,
        score_b,
        score_c,
        score_d,
        score_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      matchNumber,
      timestamp,
      alliance,
      input.aSecondTierFlags,
      input.aFirstTierFlags,
      input.aCenterFlags,
      input.bCenterFlagDown,
      input.bBaseFlagsDown,
      input.cOpponentBackfieldBullets,
      input.dRobotParkState,
      input.dGoldFlagsDefended,
      scoreBreakdown.scoreA,
      scoreBreakdown.scoreB,
      scoreBreakdown.scoreC,
      scoreBreakdown.scoreD,
      scoreBreakdown.scoreTotal
    );
};

const persistResultsRow = (
  eventDb: Database,
  tableName: "practice_results" | "quals_results" | "elims_results",
  matchNumber: number,
  redScore: number,
  blueScore: number,
  redPenaltyCommitted: number,
  bluePenaltyCommitted: number
): void => {
  eventDb.query(`DELETE FROM ${tableName} WHERE match = ?`).run(matchNumber);
  eventDb
    .query(
      `INSERT INTO ${tableName} (match, red_score, blue_score, red_penalty_committed, blue_penalty_committed) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      matchNumber,
      redScore,
      blueScore,
      redPenaltyCommitted,
      bluePenaltyCommitted
    );
};

const createDefaultScoresheetItem = (
  alliance: "red" | "blue"
): MatchHistoryItem => ({
  ts: 0,
  alliance,
  aSecondTierFlags: 0,
  aFirstTierFlags: 0,
  aCenterFlags: 0,
  bCenterFlagDown: 0,
  bBaseFlagsDown: 0,
  cOpponentBackfieldBullets: 0,
  dRobotParkState: 0,
  dGoldFlagsDefended: 0,
  scoreA: 0,
  scoreB: 0,
  scoreC: 0,
  scoreD: 0,
  scoreTotal: 0,
});

const createDefaultMatchScoresheet = (): MatchScoresheet => ({
  red: createDefaultScoresheetItem("red"),
  blue: createDefaultScoresheetItem("blue"),
});

interface LineupRow {
  blues: number;
  blueTeam: number;
  matchNumber: number;
  reds: number;
  redTeam: number;
}

interface ResultRow {
  blueScore: number | null;
  blues: number;
  blueTeam: number;
  matchNumber: number;
  redScore: number | null;
  reds: number;
  redTeam: number;
}

interface HistoryRow {
  alliance: number;
  scoreTotal: number;
  ts: number;
}

interface ScoresheetRow {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: number;
  aSecondTierFlags: number;
  bBaseFlagsDown: number;
  bCenterFlagDown: number;
  cOpponentBackfieldBullets: number;
  dGoldFlagsDefended: number;
  dRobotParkState: number;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  scoreD: number;
  scoreTotal: number;
}

const persistAllianceScoreInEventDb = (
  eventDb: Database,
  tables: ScoreTableConfig,
  input: SaveMatchAllianceScoreInput,
  scoreBreakdown: ScoreBreakdown,
  allianceValue: number,
  timestamp: number
): PersistedAllianceScoreResult => {
  ensureScoringSchema(eventDb, tables);
  assertTableExists(eventDb, tables.lineupTable);
  ensureResultsTable(eventDb, tables.resultsTable);
  assertTableExists(eventDb, tables.resultsTable);
  assertMatchExists(eventDb, tables.lineupTable, input.matchNumber);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    persistCurrentGameSpecificRow(
      eventDb,
      tables.gameSpecificTable,
      input.matchNumber,
      allianceValue,
      input,
      scoreBreakdown
    );
    persistGameSpecificHistoryRow(
      eventDb,
      tables.gameSpecificHistoryTable,
      timestamp,
      input.matchNumber,
      allianceValue,
      input,
      scoreBreakdown
    );

    const existingResult = loadExistingResultRow(
      eventDb,
      tables.resultsTable,
      input.matchNumber
    );
    const redScore =
      input.alliance === "red"
        ? scoreBreakdown.scoreTotal
        : (existingResult?.redScore ?? 0);
    const blueScore =
      input.alliance === "blue"
        ? scoreBreakdown.scoreTotal
        : (existingResult?.blueScore ?? 0);
    const redPenaltyCommitted = existingResult?.redPenaltyCommitted ?? 0;
    const bluePenaltyCommitted = existingResult?.bluePenaltyCommitted ?? 0;

    persistResultsRow(
      eventDb,
      tables.resultsTable,
      input.matchNumber,
      redScore,
      blueScore,
      redPenaltyCommitted,
      bluePenaltyCommitted
    );

    eventDb.exec("COMMIT");

    return {
      redScore,
      blueScore,
      redPenaltyCommitted,
      bluePenaltyCommitted,
    };
  } catch (error) {
    eventDb.exec("ROLLBACK");
    if (error instanceof ApplicationError) {
      throw error;
    }
    throw new ApplicationError(
      `Failed to persist match scoring: ${error instanceof Error ? error.message : "unknown error"}.`,
      500
    );
  }
};

const toSubmissionFilteredScore = (
  score: number | null,
  hasSubmission: boolean,
  submissionsAreReliable: boolean
): number | null => {
  if (score === null) {
    return null;
  }

  return !submissionsAreReliable || hasSubmission ? score : null;
};

const mapLineupRowToMatchResult = (
  row: LineupRow,
  teamNamesByNumber: Map<number, string>
): MatchResultItem => ({
  matchNumber: row.matchNumber,
  redTeam: row.redTeam,
  redTeamName: resolveTeamName(teamNamesByNumber, row.redTeam),
  blueTeam: row.blueTeam,
  blueTeamName: resolveTeamName(teamNamesByNumber, row.blueTeam),
  redSurrogate: row.reds > 0,
  blueSurrogate: row.blues > 0,
  redScore: null,
  blueScore: null,
});

const mapResultRowToMatchResult = (
  row: ResultRow,
  teamNamesByNumber: Map<number, string>,
  submissionsByMatch: MatchSubmissionSummary
): MatchResultItem => {
  const submissionState = submissionsByMatch.byMatch.get(row.matchNumber);
  const hasRedSubmission = submissionState?.hasRedSubmission ?? false;
  const hasBlueSubmission = submissionState?.hasBlueSubmission ?? false;

  return {
    matchNumber: row.matchNumber,
    redTeam: row.redTeam,
    redTeamName: resolveTeamName(teamNamesByNumber, row.redTeam),
    blueTeam: row.blueTeam,
    blueTeamName: resolveTeamName(teamNamesByNumber, row.blueTeam),
    redSurrogate: row.reds > 0,
    blueSurrogate: row.blues > 0,
    redScore: toSubmissionFilteredScore(
      row.redScore,
      hasRedSubmission,
      submissionsByMatch.isReliable
    ),
    blueScore: toSubmissionFilteredScore(
      row.blueScore,
      hasBlueSubmission,
      submissionsByMatch.isReliable
    ),
  };
};

const loadMatchResultsFromEventDb = (
  eventDb: Database,
  tables: ScoreTableConfig
): MatchResultItem[] => {
  try {
    assertTableExists(eventDb, tables.lineupTable);
  } catch (error) {
    if (isMissingRequiredTableError(error, tables.lineupTable)) {
      return [];
    }
    throw error;
  }

  const teamNamesByNumber = loadTeamNamesByNumber(eventDb);
  const submissionsByMatch = loadMatchSubmissionState(
    eventDb,
    tables.gameSpecificTable
  );

  let resultsTableExists = true;
  try {
    assertTableExists(eventDb, tables.resultsTable);
  } catch (error) {
    if (!isMissingRequiredTableError(error, tables.resultsTable)) {
      throw error;
    }
    resultsTableExists = false;
  }

  const columns = getTableColumns(eventDb, tables.lineupTable);
  const lineupExpressions = resolveLineupColumnExpressions(columns);

  if (!resultsTableExists) {
    const rows = eventDb
      .query(
        `SELECT
          match AS matchNumber,
          ${lineupExpressions.redTeamSelect},
          ${lineupExpressions.blueTeamSelect},
          ${lineupExpressions.redSurrogateSelect},
          ${lineupExpressions.blueSurrogateSelect}
         FROM ${tables.lineupTable}
         ORDER BY match ASC`
      )
      .all() as LineupRow[];

    return rows.map((row) => mapLineupRowToMatchResult(row, teamNamesByNumber));
  }

  const rows = eventDb
    .query(
      `SELECT
        l.match AS matchNumber,
        ${lineupExpressions.joinedRedTeamSelect},
        ${lineupExpressions.joinedBlueTeamSelect},
        ${lineupExpressions.joinedRedSurrogateSelect},
        ${lineupExpressions.joinedBlueSurrogateSelect},
        r.red_score AS redScore,
        r.blue_score AS blueScore
       FROM ${tables.lineupTable} l
       LEFT JOIN ${tables.resultsTable} r ON l.match = r.match
       ORDER BY l.match ASC`
    )
    .all() as ResultRow[];

  return rows.map((row) =>
    mapResultRowToMatchResult(row, teamNamesByNumber, submissionsByMatch)
  );
};

const loadMatchHistoryFromEventDb = (
  eventDb: Database,
  tables: ScoreTableConfig,
  matchNumber: number
): MatchHistoryEventItem[] => {
  assertTableExists(eventDb, tables.lineupTable);
  assertMatchExists(eventDb, tables.lineupTable, matchNumber);

  let historyTableExists = true;
  try {
    assertTableExists(eventDb, tables.gameSpecificHistoryTable);
  } catch (error) {
    if (!isMissingRequiredTableError(error, tables.gameSpecificHistoryTable)) {
      throw error;
    }
    historyTableExists = false;
  }

  if (!historyTableExists) {
    return [];
  }

  const historyColumns = getTableColumns(
    eventDb,
    tables.gameSpecificHistoryTable
  );
  if (
    !hasRequiredColumns(historyColumns, GAME_SPECIFIC_HISTORY_REQUIRED_COLUMNS)
  ) {
    return [];
  }

  const rows = eventDb
    .query(
      `SELECT ts, alliance, score_total AS scoreTotal
       FROM ${tables.gameSpecificHistoryTable}
       WHERE match = ?
       ORDER BY ts ASC`
    )
    .all(matchNumber) as HistoryRow[];

  const historyEvents: MatchHistoryEventItem[] = [];
  let currentRedScore: number | null = null;
  let currentBlueScore: number | null = null;

  for (const row of rows) {
    const alliance = row.alliance === RED_ALLIANCE_VALUE ? "red" : "blue";
    if (alliance === "red") {
      currentRedScore = row.scoreTotal;
    } else {
      currentBlueScore = row.scoreTotal;
    }

    historyEvents.push({
      ts: row.ts,
      type: alliance === "red" ? "Red Ref Save" : "Blue Ref Save",
      redScore: currentRedScore,
      blueScore: currentBlueScore,
      scoresheetAlliance: alliance,
    });
  }

  return historyEvents.reverse();
};

const toScoresheetItem = (row: ScoresheetRow): MatchHistoryItem => ({
  ts: Date.now(),
  alliance: row.alliance === RED_ALLIANCE_VALUE ? "red" : "blue",
  aSecondTierFlags: row.aSecondTierFlags,
  aFirstTierFlags: row.aFirstTierFlags,
  aCenterFlags: row.aCenterFlags,
  bCenterFlagDown: row.bCenterFlagDown,
  bBaseFlagsDown: row.bBaseFlagsDown,
  cOpponentBackfieldBullets: row.cOpponentBackfieldBullets,
  dRobotParkState: row.dRobotParkState,
  dGoldFlagsDefended: row.dGoldFlagsDefended,
  scoreA: row.scoreA,
  scoreB: row.scoreB,
  scoreC: row.scoreC,
  scoreD: row.scoreD,
  scoreTotal: row.scoreTotal,
});

const loadMatchScoresheetFromEventDb = (
  eventDb: Database,
  tables: ScoreTableConfig,
  matchNumber: number
): MatchScoresheet => {
  assertTableExists(eventDb, tables.lineupTable);
  assertMatchExists(eventDb, tables.lineupTable, matchNumber);

  let specificTableExists = true;
  try {
    assertTableExists(eventDb, tables.gameSpecificTable);
  } catch (error) {
    if (!isMissingRequiredTableError(error, tables.gameSpecificTable)) {
      throw error;
    }
    specificTableExists = false;
  }

  if (!specificTableExists) {
    return createDefaultMatchScoresheet();
  }

  const gameSpecificColumns = getTableColumns(
    eventDb,
    tables.gameSpecificTable
  );
  if (
    !hasRequiredColumns(gameSpecificColumns, GAME_SPECIFIC_REQUIRED_COLUMNS)
  ) {
    return createDefaultMatchScoresheet();
  }

  const rows = eventDb
    .query(
      `SELECT alliance, a_second_tier_flags AS aSecondTierFlags, a_first_tier_flags AS aFirstTierFlags, a_center_flags AS aCenterFlags, b_center_flag_down AS bCenterFlagDown, b_base_flags_down AS bBaseFlagsDown, c_opponent_backfield_bullets AS cOpponentBackfieldBullets, d_robot_park_state AS dRobotParkState, d_gold_flags_defended AS dGoldFlagsDefended, score_a AS scoreA, score_b AS scoreB, score_c AS scoreC, score_d AS scoreD, score_total AS scoreTotal
       FROM ${tables.gameSpecificTable}
       WHERE match = ?`
    )
    .all(matchNumber) as ScoresheetRow[];

  const result = createDefaultMatchScoresheet();
  for (const row of rows) {
    const item = toScoresheetItem(row);
    if (item.alliance === "red") {
      result.red = item;
    } else {
      result.blue = item;
    }
  }

  return result;
};

export class SQLiteScoringRepository implements ScoringRepository {
  saveAllianceScore(
    eventCode: string,
    input: SaveMatchAllianceScoreInput,
    scoreBreakdown: ScoreBreakdown
  ): Promise<PersistedAllianceScoreResult> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);

      const tables = resolveScoreTableConfig(input.matchType);
      const allianceValue = getAllianceValue(input.alliance);
      const timestamp = Date.now();

      return withEventDb(eventCode, (eventDb) =>
        persistAllianceScoreInEventDb(
          eventDb,
          tables,
          input,
          scoreBreakdown,
          allianceValue,
          timestamp
        )
      );
    });
  }

  getMatchResults(
    eventCode: string,
    matchType: MatchType
  ): Promise<MatchResultItem[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      const tables = resolveScoreTableConfig(matchType);

      return withEventDb(eventCode, (eventDb) =>
        loadMatchResultsFromEventDb(eventDb, tables)
      );
    });
  }

  getMatchHistory(
    eventCode: string,
    matchType: MatchType,
    matchNumber: number
  ): Promise<MatchHistoryEventItem[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      const tables = resolveScoreTableConfig(matchType);

      return withEventDb(eventCode, (eventDb) =>
        loadMatchHistoryFromEventDb(eventDb, tables, matchNumber)
      );
    });
  }

  getMatchScoresheet(
    eventCode: string,
    matchType: MatchType,
    matchNumber: number
  ): Promise<MatchScoresheet> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      const tables = resolveScoreTableConfig(matchType);

      return withEventDb(eventCode, (eventDb) =>
        loadMatchScoresheetFromEventDb(eventDb, tables, matchNumber)
      );
    });
  }

  clearMatchScores(
    eventCode: string,
    matchType: MatchType,
    matchNumber: number
  ): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      const tables = resolveScoreTableConfig(matchType);

      withEventDb(eventCode, (eventDb) => {
        eventDb.exec("BEGIN TRANSACTION");
        try {
          if (tableExists(eventDb, tables.gameSpecificTable)) {
            eventDb
              .query(
                `DELETE FROM ${tables.gameSpecificTable} WHERE match = ?`
              )
              .run(matchNumber);
          }
          if (tableExists(eventDb, tables.resultsTable)) {
            eventDb
              .query(`DELETE FROM ${tables.resultsTable} WHERE match = ?`)
              .run(matchNumber);
          }
          eventDb.exec("COMMIT");
        } catch (error) {
          eventDb.exec("ROLLBACK");
          throw error;
        }
      });
    });
  }
}
