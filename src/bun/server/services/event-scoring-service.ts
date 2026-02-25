import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../db";
import { ServiceError } from "./manual-event-service";

export type MatchType = "quals" | "elims";
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
    | "quals_game_specific_history"
    | "elims_game_specific_history";
  gameSpecificTable: "quals_game_specific" | "elims_game_specific";
  lineupTable: "quals" | "elims";
  resultsTable: "quals_results" | "elims_results";
}

interface ExistingResultRow {
  bluePenaltyCommitted: number;
  blueScore: number;
  redPenaltyCommitted: number;
  redScore: number;
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
  "quals",
  "elims",
  "quals_results",
  "elims_results",
  "quals_game_specific",
  "elims_game_specific",
  "quals_game_specific_history",
  "elims_game_specific_history",
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
  tableName: "quals_game_specific" | "elims_game_specific"
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
  tableName: "quals_game_specific_history" | "elims_game_specific_history"
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
  tableName: "quals_game_specific" | "elims_game_specific"
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
  tableName: "quals_game_specific_history" | "elims_game_specific_history"
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

const resolveScoreTableConfig = (matchType: MatchType): ScoreTableConfig =>
  matchType === "quals"
    ? {
        lineupTable: "quals",
        resultsTable: "quals_results",
        gameSpecificTable: "quals_game_specific",
        gameSpecificHistoryTable: "quals_game_specific_history",
      }
    : {
        lineupTable: "elims",
        resultsTable: "elims_results",
        gameSpecificTable: "elims_game_specific",
        gameSpecificHistoryTable: "elims_game_specific_history",
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
  lineupTable: "quals" | "elims",
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
  resultsTable: "quals_results" | "elims_results",
  matchNumber: number
): ExistingResultRow | null =>
  eventDb
    .query(
      `SELECT red_score AS redScore, blue_score AS blueScore, red_penalty_committed AS redPenaltyCommitted, blue_penalty_committed AS bluePenaltyCommitted FROM ${resultsTable} WHERE match = ? LIMIT 1`
    )
    .get(matchNumber) as ExistingResultRow | null;

const persistCurrentGameSpecificRow = (
  eventDb: Database,
  tableName: "quals_game_specific" | "elims_game_specific",
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
  tableName: "quals_game_specific_history" | "elims_game_specific_history",
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
  tableName: "quals_results" | "elims_results",
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
