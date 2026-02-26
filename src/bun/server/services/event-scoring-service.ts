import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../db";
import { ServiceError } from "./manual-event-service";

export type MatchType = "practice" | "quals" | "elims";
export type AllianceColor = "red" | "blue";

export interface SaveMatchAllianceScoreInput {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: AllianceColor;
  aSecondTierFlags: number;
  bBaseFlagsDown: number;
  bCenterFlagDown: number;
  cOpponentBackfieldBullets: number;
  dGoldFlagsDefended: number;
  dRobotParkState: number;
  matchNumber: number;
  matchType: MatchType;
}

export interface SaveMatchAllianceScoreResponse {
  alliance: AllianceColor;
  eventCode: string;
  gameSpecific: {
    aCenterFlags: number;
    aFirstTierFlags: number;
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
  };
  matchNumber: number;
  matchType: MatchType;
  result: {
    bluePenaltyCommitted: number;
    blueScore: number;
    redPenaltyCommitted: number;
    redScore: number;
  };
}

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
const POINTS_A_SECOND_TIER_FLAG = 25;
const POINTS_A_FIRST_TIER_FLAG = 20;
const POINTS_A_CENTER_FLAG = 10;
const POINTS_B_CENTER_FLAG_DOWN = 30;
const POINTS_B_BASE_FLAG_DOWN = 10;
const POINTS_D_GOLD_FLAG_DEFENDED = 10;
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

const assertValidTableName = (tableName: string): void => {
  if (!VALID_TABLE_NAMES.has(tableName)) {
    throw new ServiceError(`Invalid table name "${tableName}".`, 500);
  }
};

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

const toNormalizedTeamName = (teamName: string | null | undefined): string => {
  return teamName?.trim() ?? "";
};

const toFallbackTeamName = (teamNumber: number): string => {
  return `Team ${teamNumber}`;
};

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
  error instanceof ServiceError &&
  error.status === 500 &&
  error.message.includes(`"${tableName}"`);

const resolveLineupColumnExpressions = (
  lineupColumns: Set<string>
): LineupColumnExpressions => {
  if (!(lineupColumns.has("red") && lineupColumns.has("blue"))) {
    throw new ServiceError(
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
    throw new ServiceError(
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

const getAllianceValue = (alliance: AllianceColor): number =>
  alliance === "red" ? RED_ALLIANCE_VALUE : BLUE_ALLIANCE_VALUE;

const computeParkPoints = (parkState: number): number => {
  if (parkState === 1) {
    return 10;
  }

  if (parkState === 2) {
    return 15;
  }

  return 0;
};

const computeScoreBreakdown = (input: SaveMatchAllianceScoreInput) => {
  const scoreA =
    input.aSecondTierFlags * POINTS_A_SECOND_TIER_FLAG +
    input.aFirstTierFlags * POINTS_A_FIRST_TIER_FLAG +
    input.aCenterFlags * POINTS_A_CENTER_FLAG;
  const scoreB =
    input.bCenterFlagDown * POINTS_B_CENTER_FLAG_DOWN +
    input.bBaseFlagsDown * POINTS_B_BASE_FLAG_DOWN;
  const scoreC = input.cOpponentBackfieldBullets;
  const scoreD =
    computeParkPoints(input.dRobotParkState) +
    input.dGoldFlagsDefended * POINTS_D_GOLD_FLAG_DEFENDED;
  const scoreTotal = scoreA + scoreB + scoreC + scoreD;

  return {
    scoreA,
    scoreB,
    scoreC,
    scoreD,
    scoreTotal,
  };
};

const assertMatchExists = (
  eventDb: Database,
  lineupTable: "practice" | "quals" | "elims",
  matchNumber: number
): void => {
  const row = eventDb
    .query(`SELECT 1 AS has_match FROM ${lineupTable} WHERE match = ? LIMIT 1`)
    .get(matchNumber) as { has_match: number } | null;

  if (!row?.has_match) {
    throw new ServiceError(
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
  scores: ReturnType<typeof computeScoreBreakdown>
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
      scores.scoreA,
      scores.scoreB,
      scores.scoreC,
      scores.scoreD,
      scores.scoreTotal
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
  scores: ReturnType<typeof computeScoreBreakdown>
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
      scores.scoreA,
      scores.scoreB,
      scores.scoreC,
      scores.scoreD,
      scores.scoreTotal
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

export const saveMatchAllianceScore = (
  eventCode: string,
  input: SaveMatchAllianceScoreInput
): SaveMatchAllianceScoreResponse => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);

  const tables = resolveScoreTableConfig(input.matchType);
  const scoreBreakdown = computeScoreBreakdown(input);
  const allianceValue = getAllianceValue(input.alliance);
  const timestamp = Date.now();

  return withEventDb(normalizedEventCode, (eventDb) => {
    ensureScoringSchema(eventDb, tables);

    assertTableExists(eventDb, tables.lineupTable);
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
        eventCode: normalizedEventCode,
        matchType: input.matchType,
        matchNumber: input.matchNumber,
        alliance: input.alliance,
        gameSpecific: {
          aSecondTierFlags: input.aSecondTierFlags,
          aFirstTierFlags: input.aFirstTierFlags,
          aCenterFlags: input.aCenterFlags,
          bCenterFlagDown: input.bCenterFlagDown,
          bBaseFlagsDown: input.bBaseFlagsDown,
          cOpponentBackfieldBullets: input.cOpponentBackfieldBullets,
          dRobotParkState: input.dRobotParkState,
          dGoldFlagsDefended: input.dGoldFlagsDefended,
          scoreA: scoreBreakdown.scoreA,
          scoreB: scoreBreakdown.scoreB,
          scoreC: scoreBreakdown.scoreC,
          scoreD: scoreBreakdown.scoreD,
          scoreTotal: scoreBreakdown.scoreTotal,
        },
        result: {
          redScore,
          blueScore,
          redPenaltyCommitted,
          bluePenaltyCommitted,
        },
      };
    } catch (error) {
      eventDb.exec("ROLLBACK");
      if (error instanceof ServiceError) {
        throw error;
      }
      throw new ServiceError(
        `Failed to persist match scoring: ${error instanceof Error ? error.message : "unknown error"}.`,
        500
      );
    }
  });
};

export interface MatchResultItem {
  blueScore: number | null;
  blueSurrogate: boolean;
  blueTeam: number;
  blueTeamName: string;
  matchNumber: number;
  redScore: number | null;
  redSurrogate: boolean;
  redTeam: number;
  redTeamName: string;
}

export const getMatchResults = (
  eventCode: string,
  matchType: MatchType
): MatchResultItem[] => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);
  const tables = resolveScoreTableConfig(matchType);

  return withEventDb(normalizedEventCode, (eventDb) => {
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
      interface LineupRow {
        blues: number;
        blueTeam: number;
        matchNumber: number;
        reds: number;
        redTeam: number;
      }
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

      return rows.map((row) => ({
        matchNumber: row.matchNumber,
        redTeam: row.redTeam,
        redTeamName: resolveTeamName(teamNamesByNumber, row.redTeam),
        blueTeam: row.blueTeam,
        blueTeamName: resolveTeamName(teamNamesByNumber, row.blueTeam),
        redSurrogate: row.reds > 0,
        blueSurrogate: row.blues > 0,
        redScore: null,
        blueScore: null,
      }));
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

    return rows.map((row) => {
      const submissionState = submissionsByMatch.byMatch.get(row.matchNumber);
      const hasRedSubmission = submissionState?.hasRedSubmission ?? false;
      const hasBlueSubmission = submissionState?.hasBlueSubmission ?? false;
      const shouldShowResultsWithoutSubmissionCheck =
        !submissionsByMatch.isReliable;

      let redScore: number | null = null;
      if (row.redScore !== null) {
        redScore =
          shouldShowResultsWithoutSubmissionCheck || hasRedSubmission
            ? row.redScore
            : null;
      }

      let blueScore: number | null = null;
      if (row.blueScore !== null) {
        blueScore =
          shouldShowResultsWithoutSubmissionCheck || hasBlueSubmission
            ? row.blueScore
            : null;
      }

      return {
        matchNumber: row.matchNumber,
        redTeam: row.redTeam,
        redTeamName: resolveTeamName(teamNamesByNumber, row.redTeam),
        blueTeam: row.blueTeam,
        blueTeamName: resolveTeamName(teamNamesByNumber, row.blueTeam),
        redSurrogate: row.reds > 0,
        blueSurrogate: row.blues > 0,
        redScore,
        blueScore,
      };
    });
  });
};

export interface MatchHistoryItem {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: AllianceColor;
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
  ts: number;
}

export interface MatchHistoryEventItem {
  blueScore: number | null;
  redScore: number | null;
  scoresheetAlliance: AllianceColor;
  ts: number;
  type: string;
}

export const getMatchHistory = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number
): MatchHistoryEventItem[] => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);
  const tables = resolveScoreTableConfig(matchType);

  return withEventDb(normalizedEventCode, (eventDb) => {
    assertTableExists(eventDb, tables.lineupTable);
    assertMatchExists(eventDb, tables.lineupTable, matchNumber);

    let historyTableExists = true;
    try {
      assertTableExists(eventDb, tables.gameSpecificHistoryTable);
    } catch (error) {
      if (
        !isMissingRequiredTableError(error, tables.gameSpecificHistoryTable)
      ) {
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
      !hasRequiredColumns(
        historyColumns,
        GAME_SPECIFIC_HISTORY_REQUIRED_COLUMNS
      )
    ) {
      return [];
    }

    interface HistoryRow {
      alliance: number;
      scoreTotal: number;
      ts: number;
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
  });
};

export interface MatchScoresheet {
  blue: MatchHistoryItem | null;
  red: MatchHistoryItem | null;
}

const createDefaultScoresheetItem = (
  alliance: AllianceColor
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

export const getMatchScoresheet = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number
): MatchScoresheet => {
  const normalizedEventCode = normalizeEventCode(eventCode);
  assertEventExists(normalizedEventCode);
  const tables = resolveScoreTableConfig(matchType);

  return withEventDb(normalizedEventCode, (eventDb) => {
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
    const rows = eventDb
      .query(
        `SELECT alliance, a_second_tier_flags AS aSecondTierFlags, a_first_tier_flags AS aFirstTierFlags, a_center_flags AS aCenterFlags, b_center_flag_down AS bCenterFlagDown, b_base_flags_down AS bBaseFlagsDown, c_opponent_backfield_bullets AS cOpponentBackfieldBullets, d_robot_park_state AS dRobotParkState, d_gold_flags_defended AS dGoldFlagsDefended, score_a AS scoreA, score_b AS scoreB, score_c AS scoreC, score_d AS scoreD, score_total AS scoreTotal 
         FROM ${tables.gameSpecificTable} 
         WHERE match = ?`
      )
      .all(matchNumber) as ScoresheetRow[];

    const result = createDefaultMatchScoresheet();
    for (const row of rows) {
      const item: MatchHistoryItem = {
        ts: Date.now(), // gameSpecific doesn't store ts, but history item has it.
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
      };
      if (item.alliance === "red") {
        result.red = item;
      } else {
        result.blue = item;
      }
    }
    return result;
  });
};
