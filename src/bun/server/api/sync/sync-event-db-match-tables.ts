import type { Database } from "bun:sqlite";

export const ensureLineupTable = (
  eventDb: Database,
  tableName: "elims" | "practice" | "quals"
): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    match INTEGER NOT NULL,
    red INTEGER NOT NULL,
    reds INTEGER NOT NULL,
    blue INTEGER NOT NULL,
    blues INTEGER NOT NULL
  )`);
};

export const ensureMatchDataTable = (
  eventDb: Database,
  tableName: "elims_data" | "practice_data" | "quals_data"
): void => {
  if (tableName === "elims_data") {
    eventDb.exec(`CREATE TABLE IF NOT EXISTS elims_data (
      match INTEGER NOT NULL,
      status INTEGER NOT NULL,
      randomization INTEGER NOT NULL,
      start INTEGER NOT NULL,
      posted_time INTEGER NOT NULL,
      fms_match_id TEXT NOT NULL,
      fms_schedule_detail_id TEXT NOT NULL
    )`);
    return;
  }

  eventDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    match INTEGER NOT NULL,
    status INTEGER NOT NULL,
    randomization INTEGER NOT NULL,
    start INTEGER NOT NULL,
    schedule_start INTEGER NOT NULL,
    posted_time INTEGER NOT NULL,
    fms_match_id TEXT NOT NULL,
    fms_schedule_detail_id TEXT NOT NULL
  )`);
};

export const ensureResultsTable = (
  eventDb: Database,
  tableName: "elims_results" | "practice_results" | "quals_results"
): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
    match INTEGER NOT NULL,
    red_score INTEGER NOT NULL,
    blue_score INTEGER NOT NULL,
    red_penalty_committed INTEGER NOT NULL,
    blue_penalty_committed INTEGER NOT NULL
  )`);
};

export const ensureGameSpecificTables = (
  eventDb: Database,
  tableName:
    | "elims_game_specific"
    | "practice_game_specific"
    | "quals_game_specific",
  historyTable:
    | "elims_game_specific_history"
    | "practice_game_specific_history"
    | "quals_game_specific_history"
): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS ${tableName} (
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
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS ${historyTable} (
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
  )`);
};

export const ensureScheduleWindowTables = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS practice_match_schedule (
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    type INTEGER NOT NULL,
    label TEXT NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS match_schedule (
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    type INTEGER NOT NULL,
    label TEXT NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS practice_blocks (
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    type TEXT NOT NULL,
    cycle_time INTEGER NOT NULL,
    label TEXT
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS blocks (
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    type TEXT NOT NULL,
    cycle_time INTEGER NOT NULL,
    label TEXT
  )`);

  eventDb.exec(
    "CREATE TABLE IF NOT EXISTS config (key TEXT NOT NULL PRIMARY KEY, value TEXT)"
  );
};
