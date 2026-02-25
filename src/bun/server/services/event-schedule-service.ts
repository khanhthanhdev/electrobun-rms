import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../db";
import { listEventTeams } from "./event-teams-service";
import { ServiceError } from "./manual-event-service";

interface PairingEntry {
  isSurrogate: boolean;
  teamNumber: number;
}

interface SideAssignment {
  blue: PairingEntry;
  red: PairingEntry;
}

interface SideCounter {
  blue: number;
  red: number;
}

interface ScheduleWindowRow {
  end: number;
  label: string;
  start: number;
  type: number;
}

interface BlockWindowRow {
  cycleTime: number;
  end: number;
  label: string | null;
  start: number;
  type: string;
}

export interface OneVsOneScheduleMatch {
  blueSurrogate: boolean;
  blueTeam: number;
  endTime: number;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
  startTime: number;
}

export interface PracticeScheduleResponse {
  config: {
    cycleTimeSeconds: number;
    fieldCount: number;
    fieldStartOffsetSeconds: number;
    matchTimeSeconds: number;
    startTime: number | null;
  };
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
}

export interface SavePracticeScheduleInput {
  cycleTimeSeconds?: number;
  matches: SaveOneVsOneScheduleMatchInput[];
  startTime: number;
}

export interface SaveOneVsOneScheduleMatchInput {
  blueSurrogate?: boolean;
  blueTeam: number;
  matchNumber: number;
  redSurrogate?: boolean;
  redTeam: number;
}

export interface MatchBlockInput {
  cycleTimeSeconds: number;
  endTime: number;
  startTime: number;
}

export interface GeneratePracticeScheduleInput {
  fieldStartOffsetSeconds?: number;
  matchBlocks: MatchBlockInput[];
  matchesPerTeam: number;
}

export interface QualificationMetrics {
  averageSideImbalance: number;
  backToBackCount: number;
  maxOpponentRepeat: number;
  maxSideImbalance: number;
  repeatOpponentPairs: number;
  surrogateSlots: number;
}

export interface QualificationScheduleResponse {
  config: {
    cycleTimeSeconds: number;
    fieldStartOffsetSeconds: number;
    fieldCount: number;
    matchTimeSeconds: number;
    matchesPerTeam: number;
    startTime: number | null;
  };
  eventCode: string;
  isActive: boolean;
  matches: OneVsOneScheduleMatch[];
  metrics: QualificationMetrics;
}

export interface GenerateQualificationScheduleInput {
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matchesPerTeam?: number;
  startTime?: number;
}

export interface SaveQualificationScheduleInput {
  cycleTimeSeconds?: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  matches: SaveOneVsOneScheduleMatchInput[];
  startTime: number;
}

type ScheduleType = "practice" | "quals";

const EMPTY_QUALIFICATION_METRICS: QualificationMetrics = {
  averageSideImbalance: 0,
  backToBackCount: 0,
  maxOpponentRepeat: 0,
  maxSideImbalance: 0,
  repeatOpponentPairs: 0,
  surrogateSlots: 0,
};

const DEFAULT_QUALS_MATCHES_PER_TEAM = 6;
const DEFAULT_FIELD_COUNT = 2;
const DEFAULT_MATCH_TIME_SECONDS = 150;
const DEFAULT_PRACTICE_CYCLE_TIME_SECONDS = 180;
const DEFAULT_QUALS_CYCLE_TIME_SECONDS = 240;
const DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS = 15;
const PRACTICE_SCHEDULE_TYPE = 1;
const QUALS_SCHEDULE_TYPE = 2;
const PRACTICE_BLOCK_TYPE = "practice";
const QUALS_BLOCK_TYPE = "qualification";
const PRACTICE_LABEL = "Practice Schedule";
const QUALS_LABEL = "Qualification Schedule";
const ACTIVE_SCHEDULE_TYPE_CONFIG_KEY = "active_schedule_type";
const QUALS_FIELD_COUNT_CONFIG_KEY = "quals_field_count";
const QUALS_FIELD_START_OFFSET_CONFIG_KEY = "quals_field_start_offset_seconds";
const QUALS_MATCHES_PER_TEAM_CONFIG_KEY = "quals_matches_per_team";
const LEGACY_LINEUP_COLUMNS = ["red1", "red2", "blue1", "blue2"] as const;
const ONE_VS_ONE_REQUIRED_COLUMNS = [
  "match",
  "red",
  "reds",
  "blue",
  "blues",
] as const;

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

const getEventFieldCount = (eventCode: string): number => {
  const [row] = db
    .select({ fields: schema.events.fields })
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();

  return row?.fields ?? DEFAULT_FIELD_COUNT;
};

const withEventDb = <T>(
  eventCode: string,
  operation: (eventDb: Database) => T
): T => {
  // Prevent path traversal attacks
  if (
    eventCode.includes("/") ||
    eventCode.includes("\\") ||
    eventCode.includes("..")
  ) {
    throw new ServiceError(`Invalid event code "${eventCode}".`, 400);
  }

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

const createDataTableSql = (
  tableName: "practice_data" | "quals_data"
): string => `CREATE TABLE IF NOT EXISTS ${tableName} (
  match INTEGER NOT NULL,
  status INTEGER NOT NULL,
  randomization INTEGER NOT NULL,
  start INTEGER NOT NULL,
  schedule_start INTEGER NOT NULL,
  posted_time INTEGER NOT NULL,
  fms_match_id TEXT NOT NULL,
  fms_schedule_detail_id TEXT NOT NULL
)`;

const createScheduleWindowTableSql = (
  tableName: "practice_match_schedule" | "match_schedule"
): string => `CREATE TABLE IF NOT EXISTS ${tableName} (
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  type INTEGER NOT NULL,
  label TEXT NOT NULL
)`;

const createBlocksTableSql = (
  tableName: "practice_blocks" | "blocks"
): string => `CREATE TABLE IF NOT EXISTS ${tableName} (
  start INTEGER NOT NULL,
  end INTEGER NOT NULL,
  type TEXT NOT NULL,
  cycle_time INTEGER NOT NULL,
  label TEXT
)`;

const ensureOneVsOneLineupTable = (
  eventDb: Database,
  tableName: "practice" | "quals"
): void => {
  const columns = getTableColumns(eventDb, tableName);
  const hasLegacyColumns = LEGACY_LINEUP_COLUMNS.some((columnName) =>
    columns.has(columnName)
  );
  const hasAllRequiredColumns = ONE_VS_ONE_REQUIRED_COLUMNS.every(
    (columnName) => columns.has(columnName)
  );
  const shouldReset =
    columns.size > 0 && (hasLegacyColumns || !hasAllRequiredColumns);

  if (shouldReset) {
    eventDb.exec(`DROP TABLE IF EXISTS ${tableName}`);
  }

  eventDb.exec(createOneVsOneLineupTableSql(tableName));
};

const ensurePracticeTables = (eventDb: Database): void => {
  ensureOneVsOneLineupTable(eventDb, "practice");
  eventDb.exec(createDataTableSql("practice_data"));
  eventDb.exec(createScheduleWindowTableSql("practice_match_schedule"));
  eventDb.exec(createBlocksTableSql("practice_blocks"));
};

const ensureQualsTables = (eventDb: Database): void => {
  ensureOneVsOneLineupTable(eventDb, "quals");
  eventDb.exec(createDataTableSql("quals_data"));
  eventDb.exec(createScheduleWindowTableSql("match_schedule"));
  eventDb.exec(createBlocksTableSql("blocks"));
};

const ensureEventConfigTable = (eventDb: Database): void => {
  eventDb.exec(
    "CREATE TABLE IF NOT EXISTS config (key TEXT NOT NULL PRIMARY KEY, value TEXT)"
  );
};

const getActiveScheduleType = (eventDb: Database): ScheduleType | null => {
  ensureEventConfigTable(eventDb);

  const row = eventDb
    .query("SELECT value AS value FROM config WHERE key = ? LIMIT 1")
    .get(ACTIVE_SCHEDULE_TYPE_CONFIG_KEY) as { value: string | null } | null;

  if (row?.value === "practice" || row?.value === "quals") {
    return row.value;
  }

  return null;
};

const setActiveScheduleType = (
  eventDb: Database,
  value: ScheduleType | null
): void => {
  ensureEventConfigTable(eventDb);

  if (value === null) {
    eventDb
      .query("DELETE FROM config WHERE key = ?")
      .run(ACTIVE_SCHEDULE_TYPE_CONFIG_KEY);
    return;
  }

  eventDb
    .query(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(ACTIVE_SCHEDULE_TYPE_CONFIG_KEY, value);
};

const getEventConfigValue = (eventDb: Database, key: string): string | null => {
  ensureEventConfigTable(eventDb);
  const row = eventDb
    .query("SELECT value AS value FROM config WHERE key = ? LIMIT 1")
    .get(key) as { value: string | null } | null;
  return row?.value ?? null;
};

const setEventConfigValue = (
  eventDb: Database,
  key: string,
  value: string
): void => {
  ensureEventConfigTable(eventDb);
  eventDb
    .query(
      "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
};

const parsePositiveIntegerOrNull = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseNonNegativeIntegerOrNull = (value: string | null): number | null => {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const getStoredQualsFieldCount = (
  eventDb: Database,
  fallback: number
): number => {
  const parsedValue = parsePositiveIntegerOrNull(
    getEventConfigValue(eventDb, QUALS_FIELD_COUNT_CONFIG_KEY)
  );
  return parsedValue ?? fallback;
};

const getStoredQualsMatchesPerTeam = (
  eventDb: Database,
  fallback: number
): number => {
  const parsedValue = parsePositiveIntegerOrNull(
    getEventConfigValue(eventDb, QUALS_MATCHES_PER_TEAM_CONFIG_KEY)
  );
  return parsedValue ?? fallback;
};

const getStoredQualsFieldStartOffsetSeconds = (
  eventDb: Database,
  fallback: number
): number => {
  const parsedValue = parseNonNegativeIntegerOrNull(
    getEventConfigValue(eventDb, QUALS_FIELD_START_OFFSET_CONFIG_KEY)
  );
  return parsedValue ?? fallback;
};

const persistQualificationConfig = (
  eventDb: Database,
  config: {
    fieldCount: number;
    fieldStartOffsetSeconds: number;
    matchesPerTeam: number;
  }
): void => {
  setEventConfigValue(
    eventDb,
    QUALS_FIELD_COUNT_CONFIG_KEY,
    String(config.fieldCount)
  );
  setEventConfigValue(
    eventDb,
    QUALS_FIELD_START_OFFSET_CONFIG_KEY,
    String(config.fieldStartOffsetSeconds)
  );
  setEventConfigValue(
    eventDb,
    QUALS_MATCHES_PER_TEAM_CONFIG_KEY,
    String(config.matchesPerTeam)
  );
};

const updateScheduleActivation = (
  eventDb: Database,
  scheduleType: ScheduleType,
  active: boolean
): void => {
  if (active) {
    setActiveScheduleType(eventDb, scheduleType);
    return;
  }

  if (getActiveScheduleType(eventDb) === scheduleType) {
    setActiveScheduleType(eventDb, null);
  }
};

const normalizePositiveInteger = (
  value: number | undefined,
  fallbackValue: number,
  label: string
): number => {
  const normalizedValue = value ?? fallbackValue;
  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new ServiceError(`${label} must be a positive whole number.`, 400);
  }
  return normalizedValue;
};

const normalizeNonNegativeInteger = (
  value: number | undefined,
  fallbackValue: number,
  label: string
): number => {
  const normalizedValue = value ?? fallbackValue;
  if (!Number.isInteger(normalizedValue) || normalizedValue < 0) {
    throw new ServiceError(
      `${label} must be a non-negative whole number.`,
      400
    );
  }
  return normalizedValue;
};

const normalizeTimestamp = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ServiceError(
      "startTime must be a valid Unix millisecond value.",
      400
    );
  }
  return Math.trunc(value);
};

const normalizeLineupInput = (
  matches: SaveOneVsOneScheduleMatchInput[]
): SaveOneVsOneScheduleMatchInput[] => {
  const seenMatchNumbers = new Set<number>();
  const normalizedMatches = [...matches].sort(
    (left, right) => left.matchNumber - right.matchNumber
  );

  for (const match of normalizedMatches) {
    if (!Number.isInteger(match.matchNumber) || match.matchNumber <= 0) {
      throw new ServiceError(
        "Each matchNumber must be a positive integer.",
        400
      );
    }
    if (seenMatchNumbers.has(match.matchNumber)) {
      throw new ServiceError(
        `Duplicate matchNumber ${match.matchNumber} in payload.`,
        400
      );
    }
    seenMatchNumbers.add(match.matchNumber);

    if (!Number.isInteger(match.redTeam) || match.redTeam <= 0) {
      throw new ServiceError(
        `Match ${match.matchNumber}: redTeam must be a positive integer.`,
        400
      );
    }

    if (!Number.isInteger(match.blueTeam) || match.blueTeam <= 0) {
      throw new ServiceError(
        `Match ${match.matchNumber}: blueTeam must be a positive integer.`,
        400
      );
    }

    if (match.redTeam === match.blueTeam) {
      throw new ServiceError(
        `Match ${match.matchNumber}: redTeam and blueTeam cannot be the same team.`,
        400
      );
    }
  }

  return normalizedMatches;
};

const computeMatchTimes = (
  matchIndex: number,
  startTime: number,
  cycleTimeSeconds: number,
  options?: {
    fieldCount?: number;
    fieldStartOffsetSeconds?: number;
  }
): { endTime: number; startTime: number } => {
  const fieldCount = Math.max(1, options?.fieldCount ?? DEFAULT_FIELD_COUNT);
  const fieldStartOffsetMs = (options?.fieldStartOffsetSeconds ?? 0) * 1000;
  const cycleTimeMs = cycleTimeSeconds * 1000;
  const roundIndex = Math.floor(matchIndex / fieldCount);
  const fieldIndex = matchIndex % fieldCount;
  const startOffset =
    roundIndex * cycleTimeMs + fieldIndex * fieldStartOffsetMs;
  const computedStartTime = startTime + startOffset;
  const computedEndTime = computedStartTime + DEFAULT_MATCH_TIME_SECONDS * 1000;
  return {
    startTime: computedStartTime,
    endTime: computedEndTime,
  };
};

const clearScheduleTables = (
  eventDb: Database,
  options: {
    blocksTable: "practice_blocks" | "blocks";
    dataTable: "practice_data" | "quals_data";
    lineupTable: "practice" | "quals";
    scheduleTable: "practice_match_schedule" | "match_schedule";
  }
): void => {
  eventDb.query(`DELETE FROM ${options.lineupTable}`).run();
  eventDb.query(`DELETE FROM ${options.dataTable}`).run();
  eventDb.query(`DELETE FROM ${options.scheduleTable}`).run();
  eventDb.query(`DELETE FROM ${options.blocksTable}`).run();
};

const insertScheduleWindow = (
  eventDb: Database,
  options: {
    blocksLabel: string;
    blocksTable: "practice_blocks" | "blocks";
    blocksType: string;
    cycleTimeSeconds: number;
    scheduleLabel: string;
    scheduleTable: "practice_match_schedule" | "match_schedule";
    scheduleType: number;
    windowEnd: number;
    windowStart: number;
  }
): void => {
  eventDb
    .query(
      `INSERT INTO ${options.scheduleTable} (start, end, type, label) VALUES (?, ?, ?, ?)`
    )
    .run(
      options.windowStart,
      options.windowEnd,
      options.scheduleType,
      options.scheduleLabel
    );

  eventDb
    .query(
      `INSERT INTO ${options.blocksTable} (start, end, type, cycle_time, label) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      options.windowStart,
      options.windowEnd,
      options.blocksType,
      options.cycleTimeSeconds,
      options.blocksLabel
    );
};

const loadScheduleWindow = (
  eventDb: Database,
  options: {
    blocksTable: "practice_blocks" | "blocks";
    defaultCycleTimeSeconds: number;
    defaultLabel: string;
    defaultStartTime: number | null;
    scheduleTable: "practice_match_schedule" | "match_schedule";
  }
): {
  cycleTimeSeconds: number;
  endTime: number | null;
  label: string;
  startTime: number | null;
} => {
  const scheduleRow = eventDb
    .query(
      `SELECT start AS start, end AS end, type AS type, label AS label FROM ${options.scheduleTable} ORDER BY start ASC LIMIT 1`
    )
    .get() as ScheduleWindowRow | null;
  const blockRow = eventDb
    .query(
      `SELECT start AS start, end AS end, type AS type, cycle_time AS cycleTime, label AS label FROM ${options.blocksTable} ORDER BY start ASC LIMIT 1`
    )
    .get() as BlockWindowRow | null;

  return {
    startTime:
      scheduleRow?.start ?? blockRow?.start ?? options.defaultStartTime,
    endTime: scheduleRow?.end ?? blockRow?.end ?? null,
    cycleTimeSeconds: blockRow?.cycleTime ?? options.defaultCycleTimeSeconds,
    label: scheduleRow?.label ?? options.defaultLabel,
  };
};

const loadMatches = (
  eventDb: Database,
  options: {
    dataTable: "practice_data" | "quals_data";
    lineupTable: "practice" | "quals";
  }
): OneVsOneScheduleMatch[] => {
  interface MatchRow {
    blue: number;
    blues: number;
    matchNumber: number;
    red: number;
    reds: number;
    startTime: number;
  }

  const rows = eventDb
    .query(
      `SELECT l.match AS matchNumber, l.red AS red, l.reds AS reds, l.blue AS blue, l.blues AS blues, d.start AS startTime FROM ${options.lineupTable} l LEFT JOIN ${options.dataTable} d ON d.match = l.match ORDER BY l.match ASC`
    )
    .all() as MatchRow[];

  const matches: OneVsOneScheduleMatch[] = [];
  for (const row of rows) {
    const startTime = Number.isFinite(row.startTime) ? row.startTime : 0;
    matches.push({
      matchNumber: row.matchNumber,
      redTeam: row.red,
      redSurrogate: row.reds > 0,
      blueTeam: row.blue,
      blueSurrogate: row.blues > 0,
      startTime,
      endTime: startTime + DEFAULT_MATCH_TIME_SECONDS * 1000,
    });
  }

  return matches;
};

const createPairKey = (teamA: number, teamB: number): string =>
  teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;

const createSeededRandom = (seed: number): (() => number) => {
  const modulus = 2_147_483_647;
  const multiplier = 48_271;
  let randomState = Math.abs(Math.trunc(seed)) % modulus;
  if (randomState === 0) {
    randomState = 1;
  }

  return () => {
    randomState = (randomState * multiplier) % modulus;
    return randomState / modulus;
  };
};

const buildRemainingCountsByTeam = (
  entries: PairingEntry[]
): Map<number, number> => {
  const remainingCounts = new Map<number, number>();
  for (const entry of entries) {
    const previousCount = remainingCounts.get(entry.teamNumber) ?? 0;
    remainingCounts.set(entry.teamNumber, previousCount + 1);
  }
  return remainingCounts;
};

const chooseEntryIndex = (
  entries: PairingEntry[],
  random: () => number,
  currentRound?: number,
  lastRoundByTeam?: Map<number, number>
): number => {
  const remainingCounts = buildRemainingCountsByTeam(entries);
  let bestIndex = 0;
  let bestScore = -Number.POSITIVE_INFINITY;

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const remainingCount = remainingCounts.get(entry.teamNumber) ?? 0;
    const surrogatePenalty = entry.isSurrogate ? 0.4 : 0;

    let restPenalty = 0;
    if (currentRound !== undefined && lastRoundByTeam) {
      const lastRound = lastRoundByTeam.get(entry.teamNumber);
      if (lastRound !== undefined) {
        const roundGap = currentRound - lastRound;
        if (roundGap <= MIN_REST_GAP) {
          restPenalty = (MIN_REST_GAP + 1 - roundGap) * 10;
        }
      }
    }

    const score =
      remainingCount - surrogatePenalty - restPenalty + random() * 0.001;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
};

const getSideCounter = (
  sideCounts: Map<number, SideCounter>,
  teamNumber: number
): SideCounter => sideCounts.get(teamNumber) ?? { red: 0, blue: 0 };

const sideImbalanceDelta = (
  counter: SideCounter,
  side: "blue" | "red"
): number => {
  const nextRedCount = counter.red + (side === "red" ? 1 : 0);
  const nextBlueCount = counter.blue + (side === "blue" ? 1 : 0);
  return Math.abs(nextRedCount - nextBlueCount);
};

const chooseSideAssignment = (
  first: PairingEntry,
  second: PairingEntry,
  sideCounts: Map<number, SideCounter>,
  random: () => number
): SideAssignment => {
  const firstCounts = getSideCounter(sideCounts, first.teamNumber);
  const secondCounts = getSideCounter(sideCounts, second.teamNumber);

  const firstAsRedCost =
    sideImbalanceDelta(firstCounts, "red") +
    sideImbalanceDelta(secondCounts, "blue");
  const secondAsRedCost =
    sideImbalanceDelta(firstCounts, "blue") +
    sideImbalanceDelta(secondCounts, "red");

  if (firstAsRedCost < secondAsRedCost) {
    return { red: first, blue: second };
  }
  if (secondAsRedCost < firstAsRedCost) {
    return { red: second, blue: first };
  }

  return random() < 0.5
    ? { red: first, blue: second }
    : { red: second, blue: first };
};

const MIN_REST_GAP = 3;

const calculateRestPenalty = (
  currentRound: number,
  lastRoundByTeam: Map<number, number>,
  teamNumber: number
): number => {
  const previousRound = lastRoundByTeam.get(teamNumber);
  if (previousRound === undefined) {
    return 0;
  }
  const gap = currentRound - previousRound;
  if (gap <= 1) {
    return 500;
  }
  if (gap <= 2) {
    return 200;
  }
  if (gap <= MIN_REST_GAP) {
    return 80;
  }
  return 0;
};

const calculateOpponentCost = (options: {
  candidate: PairingEntry;
  currentRound: number;
  first: PairingEntry;
  lastRoundByTeam: Map<number, number>;
  pairCounts: Map<string, number>;
  random: () => number;
  sideCounts: Map<number, SideCounter>;
}): number => {
  const pairKey = createPairKey(
    options.first.teamNumber,
    options.candidate.teamNumber
  );
  const repeatPenalty = (options.pairCounts.get(pairKey) ?? 0) * 100;

  const firstRestPenalty = calculateRestPenalty(
    options.currentRound,
    options.lastRoundByTeam,
    options.first.teamNumber
  );
  const candidateRestPenalty = calculateRestPenalty(
    options.currentRound,
    options.lastRoundByTeam,
    options.candidate.teamNumber
  );

  const assignment = chooseSideAssignment(
    options.first,
    options.candidate,
    options.sideCounts,
    options.random
  );
  const redSideCounts = getSideCounter(
    options.sideCounts,
    assignment.red.teamNumber
  );
  const blueSideCounts = getSideCounter(
    options.sideCounts,
    assignment.blue.teamNumber
  );
  const sidePenalty =
    sideImbalanceDelta(redSideCounts, "red") +
    sideImbalanceDelta(blueSideCounts, "blue");
  const surrogatePairPenalty =
    options.first.isSurrogate && options.candidate.isSurrogate ? 25 : 0;

  return (
    repeatPenalty +
    firstRestPenalty +
    candidateRestPenalty +
    sidePenalty +
    surrogatePairPenalty +
    options.random() * 0.01
  );
};

const chooseOpponentIndex = (
  entries: PairingEntry[],
  firstIndex: number,
  currentRound: number,
  lastRoundByTeam: Map<number, number>,
  pairCounts: Map<string, number>,
  sideCounts: Map<number, SideCounter>,
  random: () => number
): number => {
  const first = entries[firstIndex];
  let bestIndex = -1;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let index = 0; index < entries.length; index += 1) {
    const candidate = entries[index];
    const isCandidateInvalid =
      index === firstIndex || candidate.teamNumber === first.teamNumber;
    if (isCandidateInvalid) {
      continue;
    }

    const cost = calculateOpponentCost({
      candidate,
      currentRound,
      first,
      lastRoundByTeam,
      pairCounts,
      random,
      sideCounts,
    });

    if (cost < bestCost) {
      bestCost = cost;
      bestIndex = index;
    }
  }

  if (bestIndex >= 0) {
    return bestIndex;
  }

  for (let index = 0; index < entries.length; index += 1) {
    if (index !== firstIndex) {
      return index;
    }
  }

  return firstIndex;
};

const incrementPairCount = (
  pairCounts: Map<string, number>,
  redTeam: number,
  blueTeam: number
): void => {
  const key = createPairKey(redTeam, blueTeam);
  const previousCount = pairCounts.get(key) ?? 0;
  pairCounts.set(key, previousCount + 1);
};

const incrementSideCount = (
  sideCounts: Map<number, SideCounter>,
  teamNumber: number,
  side: "blue" | "red"
): void => {
  const currentCounter = getSideCounter(sideCounts, teamNumber);
  const nextCounter: SideCounter = {
    red: currentCounter.red + (side === "red" ? 1 : 0),
    blue: currentCounter.blue + (side === "blue" ? 1 : 0),
  };
  sideCounts.set(teamNumber, nextCounter);
};

const buildQualificationLineups = (
  teamNumbers: number[],
  startTime: number,
  cycleTimeSeconds: number,
  fieldStartOffsetSeconds: number,
  fieldCount: number,
  matchesPerTeam: number
): {
  matches: OneVsOneScheduleMatch[];
  metrics: QualificationMetrics;
} => {
  const entries: PairingEntry[] = [];
  for (const teamNumber of teamNumbers) {
    for (let index = 0; index < matchesPerTeam; index += 1) {
      entries.push({ teamNumber, isSurrogate: false });
    }
  }

  if (entries.length % 2 !== 0) {
    entries.push({
      teamNumber: teamNumbers[0],
      isSurrogate: true,
    });
  }

  const randomSeed = Date.now();
  const random = createSeededRandom(randomSeed);
  const remainingEntries = [...entries];
  const pairCounts = new Map<string, number>();
  const sideCounts = new Map<number, SideCounter>();
  const lastRoundByTeam = new Map<number, number>();
  const matches: OneVsOneScheduleMatch[] = [];
  const effectiveFieldCount = Math.max(1, fieldCount);

  let matchNumber = 1;
  while (remainingEntries.length >= 2) {
    const currentRound = Math.floor((matchNumber - 1) / effectiveFieldCount);
    const firstIndex = chooseEntryIndex(
      remainingEntries,
      random,
      currentRound,
      lastRoundByTeam
    );
    const opponentIndex = chooseOpponentIndex(
      remainingEntries,
      firstIndex,
      currentRound,
      lastRoundByTeam,
      pairCounts,
      sideCounts,
      random
    );

    const first = remainingEntries[firstIndex];
    const second = remainingEntries[opponentIndex];
    const assignment = chooseSideAssignment(first, second, sideCounts, random);
    const matchTimes = computeMatchTimes(
      matchNumber - 1,
      startTime,
      cycleTimeSeconds,
      {
        fieldCount,
        fieldStartOffsetSeconds,
      }
    );

    const match: OneVsOneScheduleMatch = {
      matchNumber,
      redTeam: assignment.red.teamNumber,
      redSurrogate: assignment.red.isSurrogate,
      blueTeam: assignment.blue.teamNumber,
      blueSurrogate: assignment.blue.isSurrogate,
      startTime: matchTimes.startTime,
      endTime: matchTimes.endTime,
    };
    matches.push(match);

    incrementPairCount(pairCounts, match.redTeam, match.blueTeam);
    incrementSideCount(sideCounts, match.redTeam, "red");
    incrementSideCount(sideCounts, match.blueTeam, "blue");
    lastRoundByTeam.set(match.redTeam, currentRound);
    lastRoundByTeam.set(match.blueTeam, currentRound);

    const indexesToRemove = [firstIndex, opponentIndex].sort(
      (left, right) => right - left
    );
    for (const index of indexesToRemove) {
      remainingEntries.splice(index, 1);
    }

    matchNumber += 1;
  }

  const repeatCounts = [...pairCounts.values()].filter((count) => count > 1);
  const repeatOpponentPairs = repeatCounts.reduce(
    (total, count) => total + (count - 1),
    0
  );
  const maxOpponentRepeat =
    repeatCounts.length > 0 ? Math.max(...repeatCounts) : 1;

  let maxSideImbalance = 0;
  let sideImbalanceTotal = 0;
  for (const teamNumber of teamNumbers) {
    const counter = getSideCounter(sideCounts, teamNumber);
    const imbalance = Math.abs(counter.red - counter.blue);
    maxSideImbalance = Math.max(maxSideImbalance, imbalance);
    sideImbalanceTotal += imbalance;
  }

  let backToBackCount = 0;
  const matchesByTeam = new Map<number, number[]>();
  for (const match of matches) {
    const redMatchNumbers = matchesByTeam.get(match.redTeam) ?? [];
    redMatchNumbers.push(match.matchNumber);
    matchesByTeam.set(match.redTeam, redMatchNumbers);

    const blueMatchNumbers = matchesByTeam.get(match.blueTeam) ?? [];
    blueMatchNumbers.push(match.matchNumber);
    matchesByTeam.set(match.blueTeam, blueMatchNumbers);
  }

  for (const matchNumbers of matchesByTeam.values()) {
    matchNumbers.sort((left, right) => left - right);
    for (let index = 1; index < matchNumbers.length; index += 1) {
      if (matchNumbers[index] - matchNumbers[index - 1] === 1) {
        backToBackCount += 1;
      }
    }
  }

  const surrogateSlots = matches.reduce((count, match) => {
    let nextCount = count;
    if (match.redSurrogate) {
      nextCount += 1;
    }
    if (match.blueSurrogate) {
      nextCount += 1;
    }
    return nextCount;
  }, 0);

  const metrics: QualificationMetrics = {
    repeatOpponentPairs,
    maxOpponentRepeat,
    maxSideImbalance,
    averageSideImbalance:
      teamNumbers.length === 0 ? 0 : sideImbalanceTotal / teamNumbers.length,
    backToBackCount,
    surrogateSlots,
  };

  return {
    matches,
    metrics,
  };
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
  for (const match of options.matches) {
    eventDb
      .query(
        `INSERT INTO ${options.lineupTable} (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        match.matchNumber,
        match.redTeam,
        match.redSurrogate ? 1 : 0,
        match.blueTeam,
        match.blueSurrogate ? 1 : 0
      );

    eventDb
      .query(
        `INSERT INTO ${options.dataTable} (match, status, randomization, start, schedule_start, posted_time, fms_match_id, fms_schedule_detail_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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

const buildScheduleWindowFromMatches = (
  matches: OneVsOneScheduleMatch[],
  fallbackStartTime: number
): { endTime: number; startTime: number } => {
  if (matches.length === 0) {
    return {
      startTime: fallbackStartTime,
      endTime: fallbackStartTime + DEFAULT_MATCH_TIME_SECONDS * 1000,
    };
  }

  let earliestStart = matches[0].startTime;
  let latestEnd = matches[0].endTime;

  for (const match of matches) {
    earliestStart = Math.min(earliestStart, match.startTime);
    latestEnd = Math.max(latestEnd, match.endTime);
  }

  return {
    startTime: earliestStart,
    endTime: latestEnd,
  };
};

const inferPracticeFieldStartOffsetSeconds = (
  matches: OneVsOneScheduleMatch[],
  cycleTimeSeconds: number,
  fieldCount: number
): number => {
  if (matches.length < 2) {
    return 0;
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

  return 0;
};

export function getPracticeSchedule(
  eventCode: string
): PracticeScheduleResponse {
  assertEventExists(eventCode);
  const fieldCount = getEventFieldCount(eventCode);

  return withEventDb(eventCode, (eventDb) => {
    ensurePracticeTables(eventDb);
    const activeScheduleType = getActiveScheduleType(eventDb);

    const matches = loadMatches(eventDb, {
      lineupTable: "practice",
      dataTable: "practice_data",
    });
    const window = loadScheduleWindow(eventDb, {
      scheduleTable: "practice_match_schedule",
      blocksTable: "practice_blocks",
      defaultCycleTimeSeconds: DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
      defaultStartTime: matches[0]?.startTime ?? null,
      defaultLabel: PRACTICE_LABEL,
    });
    const fieldStartOffsetSeconds = inferPracticeFieldStartOffsetSeconds(
      matches,
      window.cycleTimeSeconds,
      fieldCount
    );

    return {
      eventCode,
      isActive: activeScheduleType === "practice",
      matches,
      config: {
        startTime: window.startTime,
        cycleTimeSeconds: window.cycleTimeSeconds,
        matchTimeSeconds: DEFAULT_MATCH_TIME_SECONDS,
        fieldStartOffsetSeconds,
        fieldCount,
      },
    };
  });
}

export function savePracticeSchedule(
  eventCode: string,
  input: SavePracticeScheduleInput
): PracticeScheduleResponse {
  assertEventExists(eventCode);

  const cycleTimeSeconds = normalizePositiveInteger(
    input.cycleTimeSeconds,
    DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
    "cycleTimeSeconds"
  );
  const startTime = normalizeTimestamp(input.startTime);
  const normalizedMatches = normalizeLineupInput(input.matches);
  const fieldCount = getEventFieldCount(eventCode);

  withEventDb(eventCode, (eventDb) => {
    ensurePracticeTables(eventDb);

    const scheduledMatches: OneVsOneScheduleMatch[] = [];
    for (let index = 0; index < normalizedMatches.length; index += 1) {
      const matchInput = normalizedMatches[index];
      const matchTimes = computeMatchTimes(index, startTime, cycleTimeSeconds, {
        fieldCount,
      });

      scheduledMatches.push({
        matchNumber: matchInput.matchNumber,
        redTeam: matchInput.redTeam,
        redSurrogate: Boolean(matchInput.redSurrogate),
        blueTeam: matchInput.blueTeam,
        blueSurrogate: Boolean(matchInput.blueSurrogate),
        startTime: matchTimes.startTime,
        endTime: matchTimes.endTime,
      });
    }

    const scheduleWindow = buildScheduleWindowFromMatches(
      scheduledMatches,
      startTime
    );

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
        matches: scheduledMatches,
      });

      insertScheduleWindow(eventDb, {
        scheduleTable: "practice_match_schedule",
        scheduleType: PRACTICE_SCHEDULE_TYPE,
        scheduleLabel: PRACTICE_LABEL,
        blocksTable: "practice_blocks",
        blocksType: PRACTICE_BLOCK_TYPE,
        blocksLabel: PRACTICE_LABEL,
        cycleTimeSeconds,
        windowStart: scheduleWindow.startTime,
        windowEnd: scheduleWindow.endTime,
      });

      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getPracticeSchedule(eventCode);
}

export function saveQualificationSchedule(
  eventCode: string,
  input: SaveQualificationScheduleInput
): QualificationScheduleResponse {
  assertEventExists(eventCode);

  const cycleTimeSeconds = normalizePositiveInteger(
    input.cycleTimeSeconds,
    DEFAULT_QUALS_CYCLE_TIME_SECONDS,
    "cycleTimeSeconds"
  );
  const fieldStartOffsetSeconds = normalizeNonNegativeInteger(
    input.fieldStartOffsetSeconds,
    DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS,
    "fieldStartOffsetSeconds"
  );
  if (fieldStartOffsetSeconds >= cycleTimeSeconds) {
    throw new ServiceError(
      "fieldStartOffsetSeconds must be smaller than cycleTimeSeconds.",
      400
    );
  }
  const startTime = normalizeTimestamp(input.startTime);
  const normalizedMatches = normalizeLineupInput(input.matches);
  const maxFieldCount = getEventFieldCount(eventCode);
  const fieldCount = normalizePositiveInteger(
    input.fieldCount,
    maxFieldCount,
    "fieldCount"
  );
  if (fieldCount > maxFieldCount) {
    throw new ServiceError(
      `fieldCount cannot exceed configured event fields (${maxFieldCount}).`,
      400
    );
  }

  // Derive matchesPerTeam from the matches array so it is always consistent
  // with the actual data. Count non-surrogate appearances per team and take
  // the maximum as the authoritative value.
  const teamMatchCounts = new Map<number, number>();
  for (const match of normalizedMatches) {
    if (!match.redSurrogate) {
      teamMatchCounts.set(
        match.redTeam,
        (teamMatchCounts.get(match.redTeam) ?? 0) + 1
      );
    }
    if (!match.blueSurrogate) {
      teamMatchCounts.set(
        match.blueTeam,
        (teamMatchCounts.get(match.blueTeam) ?? 0) + 1
      );
    }
  }
  const matchesPerTeam =
    teamMatchCounts.size > 0
      ? Math.max(...teamMatchCounts.values())
      : DEFAULT_QUALS_MATCHES_PER_TEAM;

  const scheduledMatches: OneVsOneScheduleMatch[] = [];
  for (let index = 0; index < normalizedMatches.length; index += 1) {
    const matchInput = normalizedMatches[index];
    const matchTimes = computeMatchTimes(index, startTime, cycleTimeSeconds, {
      fieldCount,
      fieldStartOffsetSeconds,
    });

    scheduledMatches.push({
      matchNumber: matchInput.matchNumber,
      redTeam: matchInput.redTeam,
      redSurrogate: Boolean(matchInput.redSurrogate),
      blueTeam: matchInput.blueTeam,
      blueSurrogate: Boolean(matchInput.blueSurrogate),
      startTime: matchTimes.startTime,
      endTime: matchTimes.endTime,
    });
  }

  withEventDb(eventCode, (eventDb) => {
    ensureQualsTables(eventDb);

    eventDb.exec("BEGIN TRANSACTION");
    try {
      persistQualificationSchedule(
        eventDb,
        scheduledMatches,
        cycleTimeSeconds,
        startTime
      );
      persistQualificationConfig(eventDb, {
        fieldCount,
        fieldStartOffsetSeconds,
        matchesPerTeam,
      });
      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getQualificationSchedule(eventCode);
}

const resolveQualsStartTime = (
  eventCode: string,
  inputStartTime: number | undefined
): number => {
  if (inputStartTime !== undefined) {
    return normalizeTimestamp(inputStartTime);
  }

  const existing = getQualificationSchedule(eventCode);
  if (existing.config.startTime !== null) {
    return existing.config.startTime;
  }

  return Date.now();
};

const inferQualificationFieldStartOffsetSeconds = (
  matches: OneVsOneScheduleMatch[],
  cycleTimeSeconds: number,
  fieldCount: number
): number => {
  if (matches.length < 2) {
    return DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS;
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

  return 0;
};

const persistQualificationSchedule = (
  eventDb: Database,
  matches: OneVsOneScheduleMatch[],
  cycleTimeSeconds: number,
  startTime: number
): void => {
  const scheduleWindow = buildScheduleWindowFromMatches(matches, startTime);

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
    matches,
  });

  insertScheduleWindow(eventDb, {
    scheduleTable: "match_schedule",
    scheduleType: QUALS_SCHEDULE_TYPE,
    scheduleLabel: QUALS_LABEL,
    blocksTable: "blocks",
    blocksType: QUALS_BLOCK_TYPE,
    blocksLabel: QUALS_LABEL,
    cycleTimeSeconds,
    windowStart: scheduleWindow.startTime,
    windowEnd: scheduleWindow.endTime,
  });
};

export function getQualificationSchedule(
  eventCode: string
): QualificationScheduleResponse {
  assertEventExists(eventCode);
  const maxFieldCount = getEventFieldCount(eventCode);

  return withEventDb(eventCode, (eventDb) => {
    ensureQualsTables(eventDb);
    const activeScheduleType = getActiveScheduleType(eventDb);
    const configuredFieldCount = getStoredQualsFieldCount(
      eventDb,
      maxFieldCount
    );
    const fieldCount = Math.min(
      Math.max(1, configuredFieldCount),
      maxFieldCount
    );
    const matchesPerTeam = getStoredQualsMatchesPerTeam(
      eventDb,
      DEFAULT_QUALS_MATCHES_PER_TEAM
    );

    const matches = loadMatches(eventDb, {
      lineupTable: "quals",
      dataTable: "quals_data",
    });
    const window = loadScheduleWindow(eventDb, {
      scheduleTable: "match_schedule",
      blocksTable: "blocks",
      defaultCycleTimeSeconds: DEFAULT_QUALS_CYCLE_TIME_SECONDS,
      defaultStartTime: matches[0]?.startTime ?? null,
      defaultLabel: QUALS_LABEL,
    });
    const storedFieldStartOffsetSeconds = getStoredQualsFieldStartOffsetSeconds(
      eventDb,
      DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS
    );
    let fieldStartOffsetSeconds =
      matches.length > 1
        ? inferQualificationFieldStartOffsetSeconds(
            matches,
            window.cycleTimeSeconds,
            fieldCount
          )
        : storedFieldStartOffsetSeconds;
    const maxFieldStartOffsetSeconds = Math.max(0, window.cycleTimeSeconds - 1);
    fieldStartOffsetSeconds = Math.min(
      Math.max(0, fieldStartOffsetSeconds),
      maxFieldStartOffsetSeconds
    );
    const metrics =
      matches.length > 0
        ? computeQualificationMetrics(matches)
        : EMPTY_QUALIFICATION_METRICS;

    return {
      eventCode,
      isActive: activeScheduleType === "quals",
      matches,
      metrics,
      config: {
        startTime: window.startTime,
        cycleTimeSeconds: window.cycleTimeSeconds,
        fieldStartOffsetSeconds,
        matchTimeSeconds: DEFAULT_MATCH_TIME_SECONDS,
        fieldCount,
        matchesPerTeam,
      },
    };
  });
}

const computeQualificationMetrics = (
  matches: OneVsOneScheduleMatch[]
): QualificationMetrics => {
  const pairCounts = new Map<string, number>();
  const sideCounts = new Map<number, SideCounter>();
  const matchesByTeam = new Map<number, number[]>();
  let surrogateSlots = 0;

  for (const match of matches) {
    incrementPairCount(pairCounts, match.redTeam, match.blueTeam);
    incrementSideCount(sideCounts, match.redTeam, "red");
    incrementSideCount(sideCounts, match.blueTeam, "blue");

    const redMatchNumbers = matchesByTeam.get(match.redTeam) ?? [];
    redMatchNumbers.push(match.matchNumber);
    matchesByTeam.set(match.redTeam, redMatchNumbers);

    const blueMatchNumbers = matchesByTeam.get(match.blueTeam) ?? [];
    blueMatchNumbers.push(match.matchNumber);
    matchesByTeam.set(match.blueTeam, blueMatchNumbers);

    if (match.redSurrogate) {
      surrogateSlots += 1;
    }
    if (match.blueSurrogate) {
      surrogateSlots += 1;
    }
  }

  const repeatCounts = [...pairCounts.values()].filter((count) => count > 1);
  const repeatOpponentPairs = repeatCounts.reduce(
    (total, count) => total + (count - 1),
    0
  );
  const maxOpponentRepeat =
    repeatCounts.length > 0 ? Math.max(...repeatCounts) : 1;

  let maxSideImbalance = 0;
  let sideImbalanceTotal = 0;
  for (const counter of sideCounts.values()) {
    const imbalance = Math.abs(counter.red - counter.blue);
    maxSideImbalance = Math.max(maxSideImbalance, imbalance);
    sideImbalanceTotal += imbalance;
  }

  let backToBackCount = 0;
  for (const matchNumbers of matchesByTeam.values()) {
    matchNumbers.sort((left, right) => left - right);
    for (let index = 1; index < matchNumbers.length; index += 1) {
      if (matchNumbers[index] - matchNumbers[index - 1] === 1) {
        backToBackCount += 1;
      }
    }
  }

  return {
    repeatOpponentPairs,
    maxOpponentRepeat,
    maxSideImbalance,
    averageSideImbalance:
      sideCounts.size === 0 ? 0 : sideImbalanceTotal / sideCounts.size,
    backToBackCount,
    surrogateSlots,
  };
};

export function generateQualificationSchedule(
  eventCode: string,
  input: GenerateQualificationScheduleInput
): QualificationScheduleResponse {
  assertEventExists(eventCode);

  const cycleTimeSeconds = normalizePositiveInteger(
    input.cycleTimeSeconds,
    DEFAULT_QUALS_CYCLE_TIME_SECONDS,
    "cycleTimeSeconds"
  );
  const fieldStartOffsetSeconds = normalizeNonNegativeInteger(
    input.fieldStartOffsetSeconds,
    DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS,
    "fieldStartOffsetSeconds"
  );
  if (fieldStartOffsetSeconds >= cycleTimeSeconds) {
    throw new ServiceError(
      "fieldStartOffsetSeconds must be smaller than cycleTimeSeconds.",
      400
    );
  }
  const startTime = resolveQualsStartTime(eventCode, input.startTime);
  const maxFieldCount = getEventFieldCount(eventCode);
  const fieldCount = normalizePositiveInteger(
    input.fieldCount,
    maxFieldCount,
    "fieldCount"
  );
  if (fieldCount > maxFieldCount) {
    throw new ServiceError(
      `fieldCount cannot exceed configured event fields (${maxFieldCount}).`,
      400
    );
  }
  const matchesPerTeam = normalizePositiveInteger(
    input.matchesPerTeam,
    DEFAULT_QUALS_MATCHES_PER_TEAM,
    "matchesPerTeam"
  );

  const teams = listEventTeams(eventCode, undefined).teams;
  const teamNumbers = teams.map((team) => team.teamNumber);
  if (teamNumbers.length < 2) {
    throw new ServiceError(
      "At least two teams are required to generate a qualification schedule.",
      400
    );
  }

  const generationResult = buildQualificationLineups(
    teamNumbers,
    startTime,
    cycleTimeSeconds,
    fieldStartOffsetSeconds,
    fieldCount,
    matchesPerTeam
  );

  withEventDb(eventCode, (eventDb) => {
    ensureQualsTables(eventDb);

    eventDb.exec("BEGIN TRANSACTION");
    try {
      persistQualificationSchedule(
        eventDb,
        generationResult.matches,
        cycleTimeSeconds,
        startTime
      );
      persistQualificationConfig(eventDb, {
        fieldCount,
        fieldStartOffsetSeconds,
        matchesPerTeam,
      });
      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getQualificationSchedule(eventCode);
}

export function clearPracticeSchedule(
  eventCode: string
): PracticeScheduleResponse {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
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
  });

  return getPracticeSchedule(eventCode);
}

export function clearQualificationSchedule(
  eventCode: string
): QualificationScheduleResponse {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
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
  });

  return getQualificationSchedule(eventCode);
}

export function setPracticeScheduleActive(
  eventCode: string,
  active: boolean
): PracticeScheduleResponse {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
    eventDb.exec("BEGIN TRANSACTION");
    try {
      updateScheduleActivation(eventDb, "practice", active);
      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getPracticeSchedule(eventCode);
}

export function setQualificationScheduleActive(
  eventCode: string,
  active: boolean
): QualificationScheduleResponse {
  assertEventExists(eventCode);

  withEventDb(eventCode, (eventDb) => {
    eventDb.exec("BEGIN TRANSACTION");
    try {
      updateScheduleActivation(eventDb, "quals", active);
      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getQualificationSchedule(eventCode);
}

/* ── Practice schedule auto-generation (MatchMaker-style) ──────────── */

interface PracticeBlockSchedulingOptions {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
}

const buildPracticeBlockMatchStartTimes = (
  block: MatchBlockInput,
  options: PracticeBlockSchedulingOptions
): number[] => {
  const durationMs = block.endTime - block.startTime;
  if (durationMs <= 0 || block.cycleTimeSeconds <= 0) {
    return [];
  }

  const cycleTimeMs = block.cycleTimeSeconds * 1000;
  const fieldStartOffsetMs =
    Math.max(0, options.fieldStartOffsetSeconds) * 1000;
  const fieldCount = Math.max(1, options.fieldCount);
  const startTimes: number[] = [];

  for (
    let roundStartOffsetMs = 0;
    roundStartOffsetMs < durationMs;
    roundStartOffsetMs += cycleTimeMs
  ) {
    let hasStartInRound = false;

    for (let fieldIndex = 0; fieldIndex < fieldCount; fieldIndex += 1) {
      const matchStartOffsetMs =
        roundStartOffsetMs + fieldIndex * fieldStartOffsetMs;
      if (matchStartOffsetMs >= durationMs) {
        continue;
      }

      startTimes.push(block.startTime + matchStartOffsetMs);
      hasStartInRound = true;
    }

    if (!hasStartInRound) {
      break;
    }
  }

  return startTimes;
};

const computeBlockCapacity = (
  block: MatchBlockInput,
  options: PracticeBlockSchedulingOptions
): number => {
  const startTimes = buildPracticeBlockMatchStartTimes(block, options);
  return startTimes.length;
};

const shuffleArray = <T>(array: T[], random: () => number): void => {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
};

/**
 * Score a schedule: lower is better.
 * - Opponent duplication penalty (seeing same opponent multiple times)
 * - Rest gap penalty (teams must rest at least MIN_REST_GAP rounds between matches)
 *
 * Gap is measured in rounds (accounting for fieldCount parallel matches).
 */
const scorePracticeSchedule = (
  schedule: [number, number][],
  fieldCount: number
): number => {
  const opponentCounts = new Map<string, number>();
  const lastRound = new Map<number, number>();
  const effectiveFieldCount = Math.max(1, fieldCount);
  let score = 0;

  for (let matchIdx = 0; matchIdx < schedule.length; matchIdx += 1) {
    const [teamA, teamB] = schedule[matchIdx];
    const currentRound = Math.floor(matchIdx / effectiveFieldCount);

    // Opponent duplication penalty
    const key = teamA < teamB ? `${teamA}:${teamB}` : `${teamB}:${teamA}`;
    const prevCount = opponentCounts.get(key) ?? 0;
    if (prevCount > 0) {
      score += prevCount * prevCount * 100;
    }
    opponentCounts.set(key, prevCount + 1);

    // Rest gap penalty – teams must have at least MIN_REST_GAP rounds between matches
    score += calculateRestPenalty(currentRound, lastRound, teamA);
    score += calculateRestPenalty(currentRound, lastRound, teamB);

    lastRound.set(teamA, currentRound);
    lastRound.set(teamB, currentRound);
  }

  return score;
};

/**
 * Balance red/blue side assignments to minimize imbalance
 */
const balanceSidesInSchedule = (schedule: [number, number][]): void => {
  const sideBalance = new Map<number, { red: number; blue: number }>();
  for (const teamIdx of schedule.flat()) {
    if (!sideBalance.has(teamIdx)) {
      sideBalance.set(teamIdx, { red: 0, blue: 0 });
    }
  }

  for (const pair of schedule) {
    const [a, b] = pair;
    const balA = sideBalance.get(a);
    const balB = sideBalance.get(b);

    if (!(balA && balB)) {
      continue; // Safety check
    }

    // Cost of A=red, B=blue
    const costAB =
      Math.abs(balA.red + 1 - balA.blue) + Math.abs(balB.blue + 1 - balB.red);
    // Cost of B=red, A=blue
    const costBA =
      Math.abs(balB.red + 1 - balB.blue) + Math.abs(balA.blue + 1 - balA.red);

    if (costAB <= costBA) {
      pair[0] = a; // red
      pair[1] = b; // blue
      balA.red += 1;
      balB.blue += 1;
    } else {
      pair[0] = b; // red
      pair[1] = a; // blue
      balB.red += 1;
      balA.blue += 1;
    }
  }
};

/**
 * Simulated annealing loop to optimize schedule
 */
const runSimulatedAnnealing = (
  initialSchedule: [number, number][],
  maxIterations: number,
  random: () => number,
  fieldCount: number
): [number, number][] => {
  let currentSchedule = initialSchedule;
  let currentScore = scorePracticeSchedule(currentSchedule, fieldCount);
  let bestSchedule = currentSchedule.map(
    (pair) => [...pair] as [number, number]
  );
  let bestScore = currentScore;

  let temperature = 100;
  const coolingRate = 0.997;

  for (let iter = 0; iter < maxIterations; iter += 1) {
    const candidate = currentSchedule.map(
      (pair) => [...pair] as [number, number]
    );

    // Pick two random positions to swap
    const totalPositions = candidate.length * 2;
    const posA = Math.floor(random() * totalPositions);
    let posB = Math.floor(random() * (totalPositions - 1));
    if (posB >= posA) {
      posB += 1;
    }

    const matchA = Math.floor(posA / 2);
    const slotA = posA % 2;
    const matchB = Math.floor(posB / 2);
    const slotB = posB % 2;

    const teamAtA = candidate[matchA][slotA];
    const teamAtB = candidate[matchB][slotB];
    if (teamAtA === teamAtB) {
      continue;
    }

    const partnerA = candidate[matchA][slotA === 0 ? 1 : 0];
    const partnerB = candidate[matchB][slotB === 0 ? 1 : 0];
    if (teamAtB === partnerA || teamAtA === partnerB) {
      continue;
    }

    candidate[matchA][slotA] = teamAtB;
    candidate[matchB][slotB] = teamAtA;

    const candidateScore = scorePracticeSchedule(candidate, fieldCount);
    const delta = candidateScore - currentScore;

    if (delta < 0 || random() < Math.exp(-delta / temperature)) {
      currentSchedule = candidate;
      currentScore = candidateScore;

      if (currentScore < bestScore) {
        bestSchedule = currentSchedule.map(
          (pair) => [...pair] as [number, number]
        );
        bestScore = currentScore;
      }
    }

    temperature *= coolingRate;

    if (bestScore === 0) {
      break;
    }
  }

  return bestSchedule;
};

/**
 * Convert schedule to final results with team numbers and surrogate flags
 */
const convertScheduleToResults = (
  schedule: [number, number][],
  teamNumbers: number[],
  matchesPerTeam: number
): Array<{
  blueTeam: number;
  isBlueSurrogate: boolean;
  isRedSurrogate: boolean;
  redTeam: number;
}> => {
  const teamAppearances = new Map<number, number>();
  const results: Array<{
    blueTeam: number;
    isBlueSurrogate: boolean;
    isRedSurrogate: boolean;
    redTeam: number;
  }> = [];

  for (const [redIdx, blueIdx] of schedule) {
    const redTeam = teamNumbers[redIdx];
    const blueTeam = teamNumbers[blueIdx];
    const redCount = (teamAppearances.get(redIdx) ?? 0) + 1;
    const blueCount = (teamAppearances.get(blueIdx) ?? 0) + 1;
    teamAppearances.set(redIdx, redCount);
    teamAppearances.set(blueIdx, blueCount);

    results.push({
      redTeam,
      blueTeam,
      isRedSurrogate: redCount > matchesPerTeam,
      isBlueSurrogate: blueCount > matchesPerTeam,
    });
  }

  return results;
};

/**
 * Simulated annealing matchmaker for 1v1 practice matches.
 * Inspired by the MatchMaker algorithm (idleloop.com).
 *
 * 1. Seed with random schedule respecting round uniformity
 * 2. Iteratively permute teams within rounds
 * 3. Accept better schedules always; accept worse with decreasing probability
 * 4. Post-process: balance red/blue sides
 */
const buildPracticeLineups = (
  teamNumbers: number[],
  matchesPerTeam: number,
  fieldCount: number
): Array<{
  blueTeam: number;
  isBlueSurrogate: boolean;
  isRedSurrogate: boolean;
  redTeam: number;
}> => {
  const numTeams = teamNumbers.length;
  if (numTeams < 2) {
    return [];
  }

  const totalSlots = numTeams * matchesPerTeam;
  const hasSurrogate = totalSlots % 2 !== 0;
  const totalMatches = Math.ceil(totalSlots / 2);

  // Build the team index pool (each team index appears matchesPerTeam times)
  const pool: number[] = [];
  for (let t = 0; t < numTeams; t += 1) {
    for (let m = 0; m < matchesPerTeam; m += 1) {
      pool.push(t);
    }
  }
  if (hasSurrogate) {
    pool.push(0); // surrogate slot for first team
  }

  const randomSeed = Date.now();
  const random = createSeededRandom(randomSeed);

  // Shuffle pool into initial schedule of pairs
  shuffleArray(pool, random);

  // Create schedule as pairs: [teamIndexA, teamIndexB]
  const currentSchedule: [number, number][] = [];
  for (let i = 0; i < pool.length - 1; i += 2) {
    currentSchedule.push([pool[i], pool[i + 1]]);
  }

  // Run simulated annealing optimization
  const maxIterations = Math.min(totalMatches * numTeams * 50, 50_000);
  const bestSchedule = runSimulatedAnnealing(
    currentSchedule,
    maxIterations,
    random,
    fieldCount
  );

  // Post-process: balance sides and convert to final results
  balanceSidesInSchedule(bestSchedule);
  return convertScheduleToResults(bestSchedule, teamNumbers, matchesPerTeam);
};

/**
 * Assign matches to time blocks and compute start/end times.
 * Returns the full list of scheduled matches with timing.
 */
const assignMatchesToBlocks = (
  lineups: Array<{
    blueTeam: number;
    isBlueSurrogate: boolean;
    isRedSurrogate: boolean;
    redTeam: number;
  }>,
  blocks: MatchBlockInput[],
  options: PracticeBlockSchedulingOptions
): OneVsOneScheduleMatch[] => {
  const matches: OneVsOneScheduleMatch[] = [];
  let matchNumber = 1;
  let lineupIdx = 0;

  for (const block of blocks) {
    if (lineupIdx >= lineups.length) {
      break;
    }

    const startTimes = buildPracticeBlockMatchStartTimes(block, options);
    for (const startTime of startTimes) {
      if (lineupIdx >= lineups.length) {
        break;
      }

      const lineup = lineups[lineupIdx];
      const endTime = startTime + DEFAULT_MATCH_TIME_SECONDS * 1000;

      matches.push({
        matchNumber,
        redTeam: lineup.redTeam,
        redSurrogate: lineup.isRedSurrogate,
        blueTeam: lineup.blueTeam,
        blueSurrogate: lineup.isBlueSurrogate,
        startTime,
        endTime,
      });

      matchNumber += 1;
      lineupIdx += 1;
    }
  }

  return matches;
};

export function generatePracticeSchedule(
  eventCode: string,
  input: GeneratePracticeScheduleInput
): PracticeScheduleResponse {
  assertEventExists(eventCode);
  const fieldCount = getEventFieldCount(eventCode);
  const fieldStartOffsetSeconds = normalizeNonNegativeInteger(
    input.fieldStartOffsetSeconds,
    0,
    "fieldStartOffsetSeconds"
  );
  const schedulingOptions: PracticeBlockSchedulingOptions = {
    fieldCount,
    fieldStartOffsetSeconds,
  };

  const matchesPerTeam = normalizePositiveInteger(
    input.matchesPerTeam,
    1,
    "matchesPerTeam"
  );

  if (!input.matchBlocks || input.matchBlocks.length === 0) {
    throw new ServiceError(
      "At least one match block is required to generate a practice schedule.",
      400
    );
  }

  // Validate & normalize blocks
  const normalizedBlocks: MatchBlockInput[] = input.matchBlocks.map(
    (block, idx) => {
      if (!Number.isFinite(block.startTime) || block.startTime <= 0) {
        throw new ServiceError(
          `Match block ${idx + 1}: startTime must be a valid timestamp.`,
          400
        );
      }
      if (!Number.isFinite(block.endTime) || block.endTime <= block.startTime) {
        throw new ServiceError(
          `Match block ${idx + 1}: endTime must be after startTime.`,
          400
        );
      }
      const cycleTimeSeconds = normalizePositiveInteger(
        block.cycleTimeSeconds,
        DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
        `Match block ${idx + 1} cycleTimeSeconds`
      );
      if (fieldStartOffsetSeconds >= cycleTimeSeconds) {
        throw new ServiceError(
          `Match block ${idx + 1}: fieldStartOffsetSeconds must be smaller than cycleTimeSeconds.`,
          400
        );
      }
      return {
        startTime: Math.trunc(block.startTime),
        endTime: Math.trunc(block.endTime),
        cycleTimeSeconds,
      };
    }
  );

  // Sort blocks by start time
  normalizedBlocks.sort((a, b) => a.startTime - b.startTime);

  // Calculate total capacity across all blocks
  let totalCapacity = 0;
  for (const block of normalizedBlocks) {
    totalCapacity += computeBlockCapacity(block, schedulingOptions);
  }

  // Load teams
  const teams = listEventTeams(eventCode, undefined).teams;
  const teamNumbers = teams.map((team) => team.teamNumber);
  if (teamNumbers.length < 2) {
    throw new ServiceError(
      "At least two teams are required to generate a practice schedule.",
      400
    );
  }

  const totalSlots = teamNumbers.length * matchesPerTeam;
  const totalMatchesNeeded = Math.ceil(totalSlots / 2);

  if (totalCapacity < totalMatchesNeeded) {
    throw new ServiceError(
      `Not enough time in match blocks. Need ${totalMatchesNeeded} matches but blocks can only fit ${totalCapacity}. Add more match blocks or increase the time window.`,
      400
    );
  }

  // Generate lineups using simulated annealing matchmaker
  const lineups = buildPracticeLineups(teamNumbers, matchesPerTeam, fieldCount);

  // Assign to time blocks
  const scheduledMatches = assignMatchesToBlocks(
    lineups,
    normalizedBlocks,
    schedulingOptions
  );

  // Persist
  withEventDb(eventCode, (eventDb) => {
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
        matches: scheduledMatches,
      });

      // Insert each block into the blocks table
      for (const block of normalizedBlocks) {
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

      // Insert overall schedule window
      const overallStart = normalizedBlocks[0].startTime;
      const overallEnd = normalizedBlocks.at(-1)?.endTime ?? overallStart;
      eventDb
        .query(
          "INSERT INTO practice_match_schedule (start, end, type, label) VALUES (?, ?, ?, ?)"
        )
        .run(overallStart, overallEnd, PRACTICE_SCHEDULE_TYPE, PRACTICE_LABEL);

      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  return getPracticeSchedule(eventCode);
}
