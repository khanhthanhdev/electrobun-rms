import type { Database } from "bun:sqlite";
import type {
  OneVsOneScheduleMatch,
  PracticeSchedulePersistenceInput,
  QualificationSchedulePersistenceInput,
  ScheduleType,
} from "../../../application/dtos/schedule";
import {
  getActiveScheduleType,
  getTableColumns,
  PRACTICE_LABEL,
  QUALS_FIELD_COUNT_CONFIG_KEY,
  QUALS_FIELD_START_OFFSET_CONFIG_KEY,
  QUALS_LABEL,
  QUALS_MATCHES_PER_TEAM_CONFIG_KEY,
  setActiveScheduleType,
  setEventConfigValue,
} from "./sqlite-schedule-shared";

const PRACTICE_SCHEDULE_TYPE = 1;
const QUALS_SCHEDULE_TYPE = 2;
const PRACTICE_BLOCK_TYPE = "practice";
const QUALS_BLOCK_TYPE = "qualification";
const LEGACY_LINEUP_COLUMNS = ["red1", "red2", "blue1", "blue2"] as const;
const ONE_VS_ONE_REQUIRED_COLUMNS = [
  "match",
  "red",
  "reds",
  "blue",
  "blues",
] as const;

const createOneVsOneLineupTableSql = (
  tableName: "practice" | "quals"
): string =>
  `CREATE TABLE IF NOT EXISTS ${tableName} (
    match INTEGER NOT NULL,
    red INTEGER NOT NULL,
    reds INTEGER NOT NULL,
    blue INTEGER NOT NULL,
    blues INTEGER NOT NULL
  )`;

const ensureOneVsOneLineupTable = (
  eventDb: Database,
  tableName: "practice" | "quals"
): void => {
  const columns = getTableColumns(eventDb, tableName);
  const shouldReset =
    columns.size > 0 &&
    (LEGACY_LINEUP_COLUMNS.some((name) => columns.has(name)) ||
      !ONE_VS_ONE_REQUIRED_COLUMNS.every((name) => columns.has(name)));

  if (shouldReset) {
    eventDb.exec(`DROP TABLE IF EXISTS ${tableName}`);
  }

  eventDb.exec(createOneVsOneLineupTableSql(tableName));
};

export const ensurePracticeTables = (eventDb: Database): void => {
  ensureOneVsOneLineupTable(eventDb, "practice");
  eventDb.exec(`CREATE TABLE IF NOT EXISTS practice_data (
    match INTEGER NOT NULL,
    status INTEGER NOT NULL,
    randomization INTEGER NOT NULL,
    start INTEGER NOT NULL,
    schedule_start INTEGER NOT NULL,
    posted_time INTEGER NOT NULL,
    fms_match_id TEXT NOT NULL,
    fms_schedule_detail_id TEXT NOT NULL
  )`);
  eventDb.exec(`CREATE TABLE IF NOT EXISTS practice_match_schedule (
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
};

export const ensureQualsTables = (eventDb: Database): void => {
  ensureOneVsOneLineupTable(eventDb, "quals");
  eventDb.exec(`CREATE TABLE IF NOT EXISTS quals_data (
    match INTEGER NOT NULL,
    status INTEGER NOT NULL,
    randomization INTEGER NOT NULL,
    start INTEGER NOT NULL,
    schedule_start INTEGER NOT NULL,
    posted_time INTEGER NOT NULL,
    fms_match_id TEXT NOT NULL,
    fms_schedule_detail_id TEXT NOT NULL
  )`);
  eventDb.exec(`CREATE TABLE IF NOT EXISTS match_schedule (
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    type INTEGER NOT NULL,
    label TEXT NOT NULL
  )`);
  eventDb.exec(`CREATE TABLE IF NOT EXISTS blocks (
    start INTEGER NOT NULL,
    end INTEGER NOT NULL,
    type TEXT NOT NULL,
    cycle_time INTEGER NOT NULL,
    label TEXT
  )`);
};

const clearScheduleTables = (
  eventDb: Database,
  tables: {
    blocksTable: "practice_blocks" | "blocks";
    dataTable: "practice_data" | "quals_data";
    lineupTable: "practice" | "quals";
    scheduleTable: "practice_match_schedule" | "match_schedule";
  }
): void => {
  eventDb.query(`DELETE FROM ${tables.lineupTable}`).run();
  eventDb.query(`DELETE FROM ${tables.dataTable}`).run();
  eventDb.query(`DELETE FROM ${tables.scheduleTable}`).run();
  eventDb.query(`DELETE FROM ${tables.blocksTable}`).run();
};

const persistLineups = (
  eventDb: Database,
  options: {
    dataTable: "practice_data" | "quals_data";
    lineupTable: "practice" | "quals";
    matches: OneVsOneScheduleMatch[];
    prefix: "P" | "Q";
  }
): void => {
  const insertLineup = eventDb.query(
    `INSERT INTO ${options.lineupTable} (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)`
  );
  const insertData = eventDb.query(
    `INSERT INTO ${options.dataTable} (match, status, randomization, start, schedule_start, posted_time, fms_match_id, fms_schedule_detail_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const match of options.matches) {
    insertLineup.run(
      match.matchNumber,
      match.redTeam,
      match.redSurrogate ? 1 : 0,
      match.blueTeam,
      match.blueSurrogate ? 1 : 0
    );
    insertData.run(
      match.matchNumber,
      0,
      0,
      match.startTime,
      match.startTime,
      0,
      `${options.prefix}${match.matchNumber}`,
      `${options.prefix}_SCHEDULE_${match.matchNumber}`
    );
  }
};

export const replacePracticeScheduleInEventDb = (
  eventDb: Database,
  input: PracticeSchedulePersistenceInput
): void => {
  ensurePracticeTables(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    clearScheduleTables(eventDb, {
      lineupTable: "practice",
      dataTable: "practice_data",
      scheduleTable: "practice_match_schedule",
      blocksTable: "practice_blocks",
    });
    persistLineups(eventDb, {
      lineupTable: "practice",
      dataTable: "practice_data",
      prefix: "P",
      matches: input.matches,
    });

    for (const block of input.blocks) {
      eventDb
        .query(
          "INSERT INTO practice_blocks (start, end, type, cycle_time, label) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          block.startTime,
          block.endTime,
          PRACTICE_BLOCK_TYPE,
          block.cycleTimeSeconds,
          PRACTICE_LABEL
        );
    }

    eventDb
      .query(
        "INSERT INTO practice_match_schedule (start, end, type, label) VALUES (?, ?, ?, ?)"
      )
      .run(
        input.window.startTime,
        input.window.endTime,
        PRACTICE_SCHEDULE_TYPE,
        PRACTICE_LABEL
      );

    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};

export const clearPracticeScheduleInEventDb = (eventDb: Database): void => {
  ensurePracticeTables(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    clearScheduleTables(eventDb, {
      lineupTable: "practice",
      dataTable: "practice_data",
      scheduleTable: "practice_match_schedule",
      blocksTable: "practice_blocks",
    });
    if (getActiveScheduleType(eventDb) === "practice") {
      setActiveScheduleType(eventDb, null);
    }
    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};

export const replaceQualificationScheduleInEventDb = (
  eventDb: Database,
  input: QualificationSchedulePersistenceInput
): void => {
  ensureQualsTables(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    clearScheduleTables(eventDb, {
      lineupTable: "quals",
      dataTable: "quals_data",
      scheduleTable: "match_schedule",
      blocksTable: "blocks",
    });
    persistLineups(eventDb, {
      lineupTable: "quals",
      dataTable: "quals_data",
      prefix: "Q",
      matches: input.matches,
    });

    const firstMatchStart = input.matches[0]?.startTime ?? input.startTime;
    const lastMatchEnd = input.matches.at(-1)?.endTime ?? firstMatchStart;
    eventDb
      .query(
        "INSERT INTO match_schedule (start, end, type, label) VALUES (?, ?, ?, ?)"
      )
      .run(firstMatchStart, lastMatchEnd, QUALS_SCHEDULE_TYPE, QUALS_LABEL);
    eventDb
      .query(
        "INSERT INTO blocks (start, end, type, cycle_time, label) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        firstMatchStart,
        lastMatchEnd,
        QUALS_BLOCK_TYPE,
        input.cycleTimeSeconds,
        QUALS_LABEL
      );

    setEventConfigValue(
      eventDb,
      QUALS_FIELD_COUNT_CONFIG_KEY,
      String(input.fieldCount)
    );
    setEventConfigValue(
      eventDb,
      QUALS_FIELD_START_OFFSET_CONFIG_KEY,
      String(input.fieldStartOffsetSeconds)
    );
    setEventConfigValue(
      eventDb,
      QUALS_MATCHES_PER_TEAM_CONFIG_KEY,
      String(input.matchesPerTeam)
    );

    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};

export const clearQualificationScheduleInEventDb = (
  eventDb: Database
): void => {
  ensureQualsTables(eventDb);

  eventDb.exec("BEGIN TRANSACTION");
  try {
    clearScheduleTables(eventDb, {
      lineupTable: "quals",
      dataTable: "quals_data",
      scheduleTable: "match_schedule",
      blocksTable: "blocks",
    });
    if (getActiveScheduleType(eventDb) === "quals") {
      setActiveScheduleType(eventDb, null);
    }
    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};

export const setScheduleActivationInEventDb = (
  eventDb: Database,
  scheduleType: ScheduleType,
  active: boolean
): void => {
  eventDb.exec("BEGIN TRANSACTION");
  try {
    if (active) {
      setActiveScheduleType(eventDb, scheduleType);
    } else if (getActiveScheduleType(eventDb) === scheduleType) {
      setActiveScheduleType(eventDb, null);
    }
    eventDb.exec("COMMIT");
  } catch (error) {
    eventDb.exec("ROLLBACK");
    throw error;
  }
};
