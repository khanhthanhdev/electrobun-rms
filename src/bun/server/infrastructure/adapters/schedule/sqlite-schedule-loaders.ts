import type { Database } from "bun:sqlite";
import type {
  OneVsOneScheduleMatch,
  PracticeScheduleSnapshot,
  QualificationScheduleSnapshot,
} from "../../../application/dtos/schedule";
import {
  ensurePracticeTables,
  ensureQualsTables,
} from "./sqlite-schedule-persistence";
import {
  DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
  DEFAULT_QUALS_CYCLE_TIME_SECONDS,
  DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS,
  DEFAULT_QUALS_MATCHES_PER_TEAM,
  getActiveScheduleType,
  getEventConfigValue,
  parseNonNegativeIntegerOrNull,
  parsePositiveIntegerOrNull,
  QUALS_FIELD_COUNT_CONFIG_KEY,
  QUALS_FIELD_START_OFFSET_CONFIG_KEY,
  QUALS_MATCHES_PER_TEAM_CONFIG_KEY,
  tableExists,
} from "./sqlite-schedule-shared";

interface ScheduleWindowRow {
  end: number;
  label: string;
  start: number;
}

interface BlockWindowRow {
  cycleTime: number;
  end: number;
  label: string | null;
  start: number;
}

interface MatchRow {
  blue: number;
  blues: number;
  matchNumber: number;
  red: number;
  reds: number;
  startTime: number;
}

const loadScheduleWindow = (
  eventDb: Database,
  options: {
    blocksTable: "practice_blocks" | "blocks";
    defaultCycleTimeSeconds: number;
    defaultStartTime: number | null;
    scheduleTable: "practice_match_schedule" | "match_schedule";
  }
): { cycleTimeSeconds: number; startTime: number | null } => {
  const scheduleRow = eventDb
    .query(
      `SELECT start AS start, end AS end, label AS label FROM ${options.scheduleTable} ORDER BY start ASC LIMIT 1`
    )
    .get() as ScheduleWindowRow | null;
  const blockRow = eventDb
    .query(
      `SELECT start AS start, end AS end, cycle_time AS cycleTime, label AS label FROM ${options.blocksTable} ORDER BY start ASC LIMIT 1`
    )
    .get() as BlockWindowRow | null;

  return {
    startTime:
      scheduleRow?.start ?? blockRow?.start ?? options.defaultStartTime,
    cycleTimeSeconds: blockRow?.cycleTime ?? options.defaultCycleTimeSeconds,
  };
};

const loadMatches = (
  eventDb: Database,
  options: {
    dataTable: "practice_data" | "quals_data";
    lineupTable: "practice" | "quals";
  }
): OneVsOneScheduleMatch[] => {
  const rows = eventDb
    .query(
      `SELECT l.match AS matchNumber, l.red AS red, l.reds AS reds, l.blue AS blue, l.blues AS blues, d.start AS startTime FROM ${options.lineupTable} l LEFT JOIN ${options.dataTable} d ON d.match = l.match ORDER BY l.match ASC`
    )
    .all() as MatchRow[];

  return rows.map((row) => {
    const startTime = Number.isFinite(row.startTime) ? row.startTime : 0;
    return {
      matchNumber: row.matchNumber,
      redTeam: row.red,
      redSurrogate: row.reds > 0,
      blueTeam: row.blue,
      blueSurrogate: row.blues > 0,
      startTime,
      endTime: startTime + 150_000,
    };
  });
};

const inferFieldStartOffsetSeconds = (
  matches: OneVsOneScheduleMatch[],
  cycleTimeSeconds: number,
  fieldCount: number,
  fallbackValue: number
): number => {
  if (matches.length < 2) {
    return fallbackValue;
  }

  for (let index = 1; index < matches.length; index += 1) {
    const previousMatch = matches[index - 1];
    const currentMatch = matches[index];
    const currentRound = Math.floor(
      (currentMatch.matchNumber - 1) / fieldCount
    );
    const previousRound = Math.floor(
      (previousMatch.matchNumber - 1) / fieldCount
    );
    if (currentRound !== previousRound) {
      continue;
    }

    const offsetSeconds = Math.round(
      (currentMatch.startTime - previousMatch.startTime) / 1000
    );
    if (offsetSeconds >= 0 && offsetSeconds < cycleTimeSeconds) {
      return offsetSeconds;
    }
  }

  return fallbackValue;
};

export const loadEventTeamNumbersFromEventDb = (
  eventDb: Database
): number[] => {
  const teamNumbers = new Set<number>();

  if (tableExists(eventDb, "teams")) {
    const rows = eventDb
      .query("SELECT number AS teamNumber FROM teams ORDER BY number ASC")
      .all() as Array<{ teamNumber: number }>;
    for (const row of rows) {
      teamNumbers.add(row.teamNumber);
    }
  }

  if (tableExists(eventDb, "team_metadata")) {
    const rows = eventDb
      .query(
        "SELECT team_number AS teamNumber FROM team_metadata ORDER BY team_number ASC"
      )
      .all() as Array<{ teamNumber: number }>;
    for (const row of rows) {
      teamNumbers.add(row.teamNumber);
    }
  }

  if (tableExists(eventDb, "team")) {
    const rows = eventDb
      .query(
        "SELECT team_number AS teamNumber FROM team ORDER BY team_number ASC"
      )
      .all() as Array<{ teamNumber: number }>;
    for (const row of rows) {
      teamNumbers.add(row.teamNumber);
    }
  }

  return [...teamNumbers].sort((left, right) => left - right);
};

export const loadPracticeScheduleFromEventDb = (
  eventDb: Database,
  fieldCount: number
): PracticeScheduleSnapshot => {
  ensurePracticeTables(eventDb);
  const matches = loadMatches(eventDb, {
    lineupTable: "practice",
    dataTable: "practice_data",
  });
  const window = loadScheduleWindow(eventDb, {
    scheduleTable: "practice_match_schedule",
    blocksTable: "practice_blocks",
    defaultCycleTimeSeconds: DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
    defaultStartTime: matches[0]?.startTime ?? null,
  });

  return {
    isActive: getActiveScheduleType(eventDb) === "practice",
    matches,
    config: {
      startTime: window.startTime,
      cycleTimeSeconds: window.cycleTimeSeconds,
      fieldCount,
      fieldStartOffsetSeconds: inferFieldStartOffsetSeconds(
        matches,
        window.cycleTimeSeconds,
        fieldCount,
        0
      ),
    },
  };
};

export const loadQualificationScheduleFromEventDb = (
  eventDb: Database,
  maxFieldCount: number
): QualificationScheduleSnapshot => {
  ensureQualsTables(eventDb);
  const matches = loadMatches(eventDb, {
    lineupTable: "quals",
    dataTable: "quals_data",
  });
  const window = loadScheduleWindow(eventDb, {
    scheduleTable: "match_schedule",
    blocksTable: "blocks",
    defaultCycleTimeSeconds: DEFAULT_QUALS_CYCLE_TIME_SECONDS,
    defaultStartTime: matches[0]?.startTime ?? null,
  });
  const fieldCount = Math.min(
    Math.max(
      1,
      parsePositiveIntegerOrNull(
        getEventConfigValue(eventDb, QUALS_FIELD_COUNT_CONFIG_KEY)
      ) ?? maxFieldCount
    ),
    maxFieldCount
  );
  const storedFieldStartOffsetSeconds =
    parseNonNegativeIntegerOrNull(
      getEventConfigValue(eventDb, QUALS_FIELD_START_OFFSET_CONFIG_KEY)
    ) ?? DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS;
  const fieldStartOffsetSeconds = Math.min(
    Math.max(
      0,
      inferFieldStartOffsetSeconds(
        matches,
        window.cycleTimeSeconds,
        fieldCount,
        storedFieldStartOffsetSeconds
      )
    ),
    Math.max(0, window.cycleTimeSeconds - 1)
  );
  const matchesPerTeam =
    parsePositiveIntegerOrNull(
      getEventConfigValue(eventDb, QUALS_MATCHES_PER_TEAM_CONFIG_KEY)
    ) ?? DEFAULT_QUALS_MATCHES_PER_TEAM;

  return {
    isActive: getActiveScheduleType(eventDb) === "quals",
    matches,
    config: {
      startTime: window.startTime,
      cycleTimeSeconds: window.cycleTimeSeconds,
      fieldCount,
      fieldStartOffsetSeconds,
      matchesPerTeam,
    },
  };
};
