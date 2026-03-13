import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "../../../db";
import { qualificationRankingsSyncHub } from "../events/rankings-sync";
import { inspectionSyncHub } from "../inspection/inspection-sync";
import { scoringSyncHub } from "../scoring/scoring-sync";
import { type MachinePushResourceType, SYNC_SEASON } from "./sync.schema";

type MatchPhase = "PRACTICE" | "PLAYOFF" | "QUALIFICATION";
type MatchType = "elims" | "practice" | "quals";
type PushMode = "replace_snapshot" | "upsert";

interface SyncRecord {
  [key: string]: unknown;
}

export interface EventTeamDirectoryEntry {
  city?: string;
  country?: string;
  fmsTeamId: string;
  organizationName: string;
  teamName: string;
  teamNumber: string;
}

export interface StagedSyncChangeSet {
  mode: PushMode;
  records: SyncRecord[];
  resourceType: MachinePushResourceType;
}

interface ApplyNotifications {
  inspectionTeamNumbers: Set<number>;
  rankingUpdated: boolean;
  scoringUpdates: Array<{ matchNumber: number; matchType: MatchType }>;
}

interface MatchLineup {
  blueTeam: number;
  matchNumber: number;
  redTeam: number;
  scheduledAt: number;
  status: number;
}

const DEFAULT_MATCH_CYCLE_MS = 4 * 60 * 1000;
const DEFAULT_MATCH_DURATION_MS = 150 * 1000;
const MATCH_NUMBER_REGEX = /(\d+)(?!.*\d)/;
const MATCH_STATUS_COMPLETE = new Set([
  "COMPLETE",
  "COMPLETED",
  "FINAL",
  "POSTED",
]);

const buildSyntheticFmsTeamId = (teamNumber: string): string =>
  `LOCAL_TEAM_${teamNumber}`;

const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;

  return Boolean(row?.has_table);
};

const withEventDb = <T>(
  eventCode: string,
  operation: (eventDb: Database) => T
): T => {
  if (
    eventCode.includes("/") ||
    eventCode.includes("\\") ||
    eventCode.includes("..")
  ) {
    throw new Error(`Invalid event code "${eventCode}".`);
  }

  const eventDbPath = join(DATA_DIR, `${eventCode}.db`);
  if (!existsSync(eventDbPath)) {
    throw new Error(`Database file for event "${eventCode}" was not found.`);
  }

  const eventDb = new Database(eventDbPath);
  try {
    return operation(eventDb);
  } finally {
    eventDb.close();
  }
};

const parseTimestamp = (value: unknown, fallback: number): number => {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parsePositiveInteger = (value: unknown, fallback: number): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return fallback;
};

const parseRequiredTeamNumber = (value: unknown): number => {
  const teamNumber = parsePositiveInteger(value, Number.NaN);
  if (!Number.isFinite(teamNumber) || teamNumber <= 0) {
    throw new Error(`Invalid team number "${String(value)}".`);
  }

  return teamNumber;
};

const toBooleanInt = (value: unknown): number => (value ? 1 : 0);

const resolveMatchNumber = (record: SyncRecord, fallback: number): number => {
  if ("matchNumber" in record) {
    return parsePositiveInteger(record.matchNumber, fallback);
  }

  const matchKey = typeof record.matchKey === "string" ? record.matchKey : "";
  const matchNumberMatch = matchKey.match(MATCH_NUMBER_REGEX);
  if (!matchNumberMatch) {
    return fallback;
  }

  return parsePositiveInteger(matchNumberMatch[1], fallback);
};

const getExistingEventId = (eventDb: Database): string | null => {
  if (!tableExists(eventDb, "team_ranking")) {
    return null;
  }

  const row = eventDb
    .query(
      "SELECT fms_event_id AS eventId FROM team_ranking WHERE fms_event_id IS NOT NULL AND fms_event_id != '' LIMIT 1"
    )
    .get() as { eventId: string | null } | null;

  return row?.eventId?.trim() || null;
};

const loadEventTeamDirectoryFromDb = (
  eventDb: Database
): EventTeamDirectoryEntry[] => {
  const teamsByNumber = new Map<string, EventTeamDirectoryEntry>();

  if (tableExists(eventDb, "team")) {
    const rows = eventDb
      .query(
        `SELECT
          team_number AS teamNumber,
          fms_team_id AS fmsTeamId,
          COALESCE(NULLIF(team_name_long, ''), team_name_short, '') AS teamName,
          COALESCE(school_name, '') AS organizationName,
          COALESCE(city, '') AS city,
          COALESCE(country, '') AS country
         FROM team
         ORDER BY team_number ASC`
      )
      .all() as Array<{
      city: string;
      country: string;
      fmsTeamId: string | null;
      organizationName: string;
      teamName: string;
      teamNumber: number;
    }>;

    for (const row of rows) {
      const teamNumber = String(row.teamNumber);
      teamsByNumber.set(teamNumber, {
        city: row.city || undefined,
        country: row.country || undefined,
        fmsTeamId: row.fmsTeamId?.trim() || buildSyntheticFmsTeamId(teamNumber),
        organizationName: row.organizationName || "",
        teamName: row.teamName || `Team ${teamNumber}`,
        teamNumber,
      });
    }
  }

  if (tableExists(eventDb, "team_metadata")) {
    const rows = eventDb
      .query(
        `SELECT
          team_number AS teamNumber,
          COALESCE(team_name, '') AS teamName,
          COALESCE(organization_school, '') AS organizationName,
          COALESCE(city, '') AS city,
          COALESCE(country, '') AS country
         FROM team_metadata
         ORDER BY team_number ASC`
      )
      .all() as Array<{
      city: string;
      country: string;
      organizationName: string;
      teamName: string;
      teamNumber: number;
    }>;

    for (const row of rows) {
      const teamNumber = String(row.teamNumber);
      const existing = teamsByNumber.get(teamNumber);
      teamsByNumber.set(teamNumber, {
        city: row.city || existing?.city,
        country: row.country || existing?.country,
        fmsTeamId: existing?.fmsTeamId || buildSyntheticFmsTeamId(teamNumber),
        organizationName:
          row.organizationName || existing?.organizationName || "",
        teamName: row.teamName || existing?.teamName || `Team ${teamNumber}`,
        teamNumber,
      });
    }
  }

  if (tableExists(eventDb, "teams")) {
    const rows = eventDb
      .query("SELECT number AS teamNumber FROM teams ORDER BY number ASC")
      .all() as Array<{ teamNumber: number }>;

    for (const row of rows) {
      const teamNumber = String(row.teamNumber);
      const existing = teamsByNumber.get(teamNumber);
      teamsByNumber.set(teamNumber, {
        city: existing?.city,
        country: existing?.country,
        fmsTeamId: existing?.fmsTeamId || buildSyntheticFmsTeamId(teamNumber),
        organizationName: existing?.organizationName || "",
        teamName: existing?.teamName || `Team ${teamNumber}`,
        teamNumber,
      });
    }
  }

  return Array.from(teamsByNumber.values()).sort(
    (left, right) => Number(left.teamNumber) - Number(right.teamNumber)
  );
};

export const loadEventTeamDirectory = (
  eventCode: string
): EventTeamDirectoryEntry[] =>
  withEventDb(eventCode, (eventDb) => loadEventTeamDirectoryFromDb(eventDb));

const ensureInspectionTables = (eventDb: Database): void => {
  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspections (
    team_number INTEGER NOT NULL PRIMARY KEY,
    status TEXT NOT NULL,
    comment TEXT,
    started_at INTEGER,
    finalized_at INTEGER,
    updated_at INTEGER NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_number INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT,
    new_status TEXT,
    is_override INTEGER NOT NULL DEFAULT 0,
    changed_by TEXT,
    changed_at INTEGER NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_schedule_form (
    id INTEGER NOT NULL,
    str TEXT NOT NULL
  )`);

  eventDb.exec(`CREATE TABLE IF NOT EXISTS inspection_schedule_items (
    id INTEGER NOT NULL,
    team INTEGER NOT NULL,
    name TEXT NOT NULL,
    station_number INTEGER NOT NULL,
    start_time INTEGER NOT NULL,
    total_time INTEGER NOT NULL,
    month INTEGER NOT NULL,
    day INTEGER NOT NULL,
    year INTEGER NOT NULL
  )`);
};

const ensureLineupTable = (
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

const ensureMatchDataTable = (
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

const ensureResultsTable = (
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

const ensureGameSpecificTables = (
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

const ensureScheduleWindowTables = (eventDb: Database): void => {
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

const resolveMatchType = (phase: MatchPhase): MatchType => {
  if (phase === "PRACTICE") {
    return "practice";
  }

  if (phase === "PLAYOFF") {
    return "elims";
  }

  return "quals";
};

const resolveAllianceTeams = (
  record: SyncRecord
): { blueTeam: number; redTeam: number } => {
  const alliances = Array.isArray(record.alliances)
    ? (record.alliances as Array<{ color?: string; teamNumbers?: unknown[] }>)
    : [];

  const red = alliances.find((entry) => entry.color === "RED");
  const blue = alliances.find((entry) => entry.color === "BLUE");
  if (!(red?.teamNumbers?.length && blue?.teamNumbers?.length)) {
    throw new Error("Match records require one RED and one BLUE alliance.");
  }

  return {
    blueTeam: parseRequiredTeamNumber(blue.teamNumbers[0]),
    redTeam: parseRequiredTeamNumber(red.teamNumbers[0]),
  };
};

const resolveMatchStatus = (status: unknown): number =>
  MATCH_STATUS_COMPLETE.has(String(status).toUpperCase()) ? 1 : 0;

const inferCycleTime = (matches: MatchLineup[]): number => {
  if (matches.length < 2) {
    return DEFAULT_MATCH_CYCLE_MS;
  }

  const sortedStarts = [...matches]
    .map((match) => match.scheduledAt)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

  if (sortedStarts.length < 2) {
    return DEFAULT_MATCH_CYCLE_MS;
  }

  return Math.max(DEFAULT_MATCH_DURATION_MS, sortedStarts[1] - sortedStarts[0]);
};

const applyInspectionScheduleSnapshot = (
  eventDb: Database,
  records: SyncRecord[]
): void => {
  ensureInspectionTables(eventDb);
  eventDb.query("DELETE FROM inspection_schedule_items").run();
  eventDb.query("DELETE FROM inspection_schedule_form").run();

  const stageIds = new Map<string, number>();
  let nextStageId = 1;

  for (const record of records) {
    const stage = String(record.stage ?? "GENERAL").trim() || "GENERAL";
    if (!stageIds.has(stage)) {
      stageIds.set(stage, nextStageId);
      eventDb
        .query("INSERT INTO inspection_schedule_form (id, str) VALUES (?, ?)")
        .run(nextStageId, stage);
      nextStageId += 1;
    }

    const startsAt = parseTimestamp(record.startsAt, 0);
    const date = startsAt > 0 ? new Date(startsAt) : null;
    const stageId = stageIds.get(stage);

    if (!stageId) {
      continue;
    }

    eventDb
      .query(
        `INSERT INTO inspection_schedule_items (
          id,
          team,
          name,
          station_number,
          start_time,
          total_time,
          month,
          day,
          year
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        stageId,
        parseRequiredTeamNumber(record.teamNumber),
        stage,
        parsePositiveInteger(record.stationNumber, 0),
        startsAt,
        parsePositiveInteger(record.durationMinutes, 0),
        date ? date.getUTCMonth() + 1 : 0,
        date ? date.getUTCDate() : 0,
        date ? date.getUTCFullYear() : 0
      );
  }
};

const applyInspectionResults = (
  eventDb: Database,
  records: SyncRecord[],
  notifications: ApplyNotifications
): void => {
  ensureInspectionTables(eventDb);

  for (const record of records) {
    const teamNumber = parseRequiredTeamNumber(record.teamNumber);
    const nextStatus =
      String(record.status ?? "NOT_STARTED").trim() || "NOT_STARTED";
    const recordedAt = parseTimestamp(record.recordedAt, Date.now());
    const existing = eventDb
      .query(
        `SELECT
          status AS status,
          comment AS comment,
          started_at AS startedAt,
          finalized_at AS finalizedAt
         FROM inspections
         WHERE team_number = ?
         LIMIT 1`
      )
      .get(teamNumber) as {
      comment: string | null;
      finalizedAt: number | null;
      startedAt: number | null;
      status: string | null;
    } | null;

    const previousStatus = existing?.status ?? "NOT_STARTED";
    const comment =
      typeof record.comment === "string"
        ? record.comment
        : (existing?.comment ?? null);
    const startedAt =
      nextStatus === "IN_PROGRESS"
        ? (existing?.startedAt ?? recordedAt)
        : (existing?.startedAt ?? null);
    const finalizedAt =
      nextStatus === "INCOMPLETE" || nextStatus === "PASSED"
        ? recordedAt
        : null;

    eventDb
      .query(
        `INSERT INTO inspections (
          team_number,
          status,
          comment,
          started_at,
          finalized_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(team_number) DO UPDATE SET
          status = excluded.status,
          comment = excluded.comment,
          started_at = excluded.started_at,
          finalized_at = excluded.finalized_at,
          updated_at = excluded.updated_at`
      )
      .run(teamNumber, nextStatus, comment, startedAt, finalizedAt, recordedAt);

    if (
      previousStatus !== nextStatus ||
      comment !== (existing?.comment ?? null)
    ) {
      eventDb
        .query(
          `INSERT INTO inspection_history (
            team_number,
            action,
            old_status,
            new_status,
            is_override,
            changed_by,
            changed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          teamNumber,
          "SYNC_IMPORT",
          previousStatus,
          nextStatus,
          0,
          "sync-api",
          recordedAt
        );
    }

    notifications.inspectionTeamNumbers.add(teamNumber);
  }
};

const clearScheduleTables = (eventDb: Database): void => {
  ensureLineupTable(eventDb, "practice");
  ensureLineupTable(eventDb, "quals");
  ensureLineupTable(eventDb, "elims");
  ensureMatchDataTable(eventDb, "practice_data");
  ensureMatchDataTable(eventDb, "quals_data");
  ensureMatchDataTable(eventDb, "elims_data");
  ensureScheduleWindowTables(eventDb);

  for (const tableName of [
    "practice",
    "practice_data",
    "practice_match_schedule",
    "practice_blocks",
    "quals",
    "quals_data",
    "match_schedule",
    "blocks",
    "elims",
    "elims_data",
  ]) {
    eventDb.query(`DELETE FROM ${tableName}`).run();
  }
};

const applyMatchScheduleSnapshot = (
  eventDb: Database,
  records: SyncRecord[]
): void => {
  clearScheduleTables(eventDb);

  const grouped = new Map<MatchType, MatchLineup[]>();
  const now = Date.now();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const phase = String(record.phase ?? "QUALIFICATION") as MatchPhase;
    const matchType = resolveMatchType(phase);
    const groupedMatches = grouped.get(matchType) ?? [];
    const { blueTeam, redTeam } = resolveAllianceTeams(record);

    groupedMatches.push({
      blueTeam,
      matchNumber: parsePositiveInteger(record.matchNumber, index + 1),
      redTeam,
      scheduledAt: parseTimestamp(
        record.scheduledAt,
        now + index * DEFAULT_MATCH_CYCLE_MS
      ),
      status: resolveMatchStatus(record.status),
    });
    grouped.set(matchType, groupedMatches);
  }

  for (const [matchType, matches] of grouped.entries()) {
    matches.sort((left, right) => left.matchNumber - right.matchNumber);
    const cycleTime = inferCycleTime(matches);

    if (matchType === "practice") {
      for (const match of matches) {
        eventDb
          .query(
            "INSERT INTO practice (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)"
          )
          .run(match.matchNumber, match.redTeam, 0, match.blueTeam, 0);

        eventDb
          .query(
            `INSERT INTO practice_data (
              match,
              status,
              randomization,
              start,
              schedule_start,
              posted_time,
              fms_match_id,
              fms_schedule_detail_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            match.matchNumber,
            match.status,
            0,
            match.scheduledAt,
            match.scheduledAt,
            0,
            `P${match.matchNumber}`,
            `P_SCHEDULE_${match.matchNumber}`
          );
      }

      const start = matches[0]?.scheduledAt ?? 0;
      const end =
        (matches.at(-1)?.scheduledAt ?? 0) + DEFAULT_MATCH_DURATION_MS;
      eventDb
        .query(
          "INSERT INTO practice_match_schedule (start, end, type, label) VALUES (?, ?, ?, ?)"
        )
        .run(start, end, 1, "Practice Schedule");
      eventDb
        .query(
          "INSERT INTO practice_blocks (start, end, type, cycle_time, label) VALUES (?, ?, ?, ?, ?)"
        )
        .run(start, end, "practice", cycleTime, "Practice Schedule");
      continue;
    }

    if (matchType === "quals") {
      for (const match of matches) {
        eventDb
          .query(
            "INSERT INTO quals (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)"
          )
          .run(match.matchNumber, match.redTeam, 0, match.blueTeam, 0);

        eventDb
          .query(
            `INSERT INTO quals_data (
              match,
              status,
              randomization,
              start,
              schedule_start,
              posted_time,
              fms_match_id,
              fms_schedule_detail_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            match.matchNumber,
            match.status,
            0,
            match.scheduledAt,
            match.scheduledAt,
            0,
            `Q${match.matchNumber}`,
            `Q_SCHEDULE_${match.matchNumber}`
          );
      }

      const start = matches[0]?.scheduledAt ?? 0;
      const end =
        (matches.at(-1)?.scheduledAt ?? 0) + DEFAULT_MATCH_DURATION_MS;
      eventDb
        .query(
          "INSERT INTO match_schedule (start, end, type, label) VALUES (?, ?, ?, ?)"
        )
        .run(start, end, 2, "Qualification Schedule");
      eventDb
        .query(
          "INSERT INTO blocks (start, end, type, cycle_time, label) VALUES (?, ?, ?, ?, ?)"
        )
        .run(start, end, "qualification", cycleTime, "Qualification Schedule");
      continue;
    }

    for (const match of matches) {
      eventDb
        .query("INSERT INTO elims (match, red, blue) VALUES (?, ?, ?)")
        .run(match.matchNumber, match.redTeam, match.blueTeam);

      eventDb
        .query(
          `INSERT INTO elims_data (
            match,
            status,
            randomization,
            start,
            posted_time,
            fms_match_id,
            fms_schedule_detail_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          match.matchNumber,
          match.status,
          0,
          match.scheduledAt,
          0,
          `E${match.matchNumber}`,
          `E_SCHEDULE_${match.matchNumber}`
        );
    }
  }

  if (grouped.has("quals")) {
    eventDb
      .query(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run("active_schedule_type", "quals");
  } else if (grouped.has("practice")) {
    eventDb
      .query(
        "INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
      )
      .run("active_schedule_type", "practice");
  } else {
    eventDb
      .query("DELETE FROM config WHERE key = ?")
      .run("active_schedule_type");
  }
};

const ensureMatchExists = (
  eventDb: Database,
  matchType: MatchType,
  record: SyncRecord,
  fallbackTimestamp: number
): void => {
  const { blueTeam, redTeam } = resolveAllianceTeams(record);
  const matchNumber = resolveMatchNumber(record, 0);
  if (matchNumber <= 0) {
    throw new Error(
      `Unable to resolve match number for record "${String(record.matchKey)}".`
    );
  }
  const status = resolveMatchStatus(record.status);
  const scheduledAt = parseTimestamp(
    record.playedAt ?? record.scheduledAt,
    fallbackTimestamp
  );

  if (matchType === "practice") {
    ensureLineupTable(eventDb, "practice");
    ensureMatchDataTable(eventDb, "practice_data");
    eventDb.query("DELETE FROM practice WHERE match = ?").run(matchNumber);
    eventDb
      .query(
        "INSERT INTO practice (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)"
      )
      .run(matchNumber, redTeam, 0, blueTeam, 0);
    eventDb.query("DELETE FROM practice_data WHERE match = ?").run(matchNumber);
    eventDb
      .query(
        `INSERT INTO practice_data (
          match,
          status,
          randomization,
          start,
          schedule_start,
          posted_time,
          fms_match_id,
          fms_schedule_detail_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        matchNumber,
        status,
        0,
        scheduledAt,
        scheduledAt,
        0,
        `P${matchNumber}`,
        `P_SCHEDULE_${matchNumber}`
      );
    return;
  }

  if (matchType === "quals") {
    ensureLineupTable(eventDb, "quals");
    ensureMatchDataTable(eventDb, "quals_data");
    eventDb.query("DELETE FROM quals WHERE match = ?").run(matchNumber);
    eventDb
      .query(
        "INSERT INTO quals (match, red, reds, blue, blues) VALUES (?, ?, ?, ?, ?)"
      )
      .run(matchNumber, redTeam, 0, blueTeam, 0);
    eventDb.query("DELETE FROM quals_data WHERE match = ?").run(matchNumber);
    eventDb
      .query(
        `INSERT INTO quals_data (
          match,
          status,
          randomization,
          start,
          schedule_start,
          posted_time,
          fms_match_id,
          fms_schedule_detail_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        matchNumber,
        status,
        0,
        scheduledAt,
        scheduledAt,
        0,
        `Q${matchNumber}`,
        `Q_SCHEDULE_${matchNumber}`
      );
    return;
  }

  ensureLineupTable(eventDb, "elims");
  ensureMatchDataTable(eventDb, "elims_data");
  eventDb.query("DELETE FROM elims WHERE match = ?").run(matchNumber);
  eventDb
    .query("INSERT INTO elims (match, red, blue) VALUES (?, ?, ?)")
    .run(matchNumber, redTeam, blueTeam);
  eventDb.query("DELETE FROM elims_data WHERE match = ?").run(matchNumber);
  eventDb
    .query(
      `INSERT INTO elims_data (
        match,
        status,
        randomization,
        start,
        posted_time,
        fms_match_id,
        fms_schedule_detail_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      matchNumber,
      status,
      0,
      scheduledAt,
      0,
      `E${matchNumber}`,
      `E_SCHEDULE_${matchNumber}`
    );
};

const applyMatchResults = (
  eventDb: Database,
  records: SyncRecord[],
  notifications: ApplyNotifications
): void => {
  const now = Date.now();

  for (const record of records) {
    const phase = String(record.phase ?? "QUALIFICATION") as MatchPhase;
    const matchType = resolveMatchType(phase);
    const matchNumber = resolveMatchNumber(record, 0);
    if (matchNumber <= 0) {
      throw new Error(
        `Unable to resolve match number for record "${String(record.matchKey)}".`
      );
    }
    const playedAt = parseTimestamp(record.playedAt, now);
    const postedTime = MATCH_STATUS_COMPLETE.has(
      String(record.status).toUpperCase()
    )
      ? playedAt
      : 0;

    ensureMatchExists(eventDb, matchType, record, playedAt);

    let resultsTable: "quals_results" | "elims_results" | "practice_results";
    if (matchType === "practice") {
      resultsTable = "practice_results";
    } else if (matchType === "quals") {
      resultsTable = "quals_results";
    } else {
      resultsTable = "elims_results";
    }
    ensureResultsTable(eventDb, resultsTable);
    eventDb
      .query(`DELETE FROM ${resultsTable} WHERE match = ?`)
      .run(matchNumber);
    eventDb
      .query(
        `INSERT INTO ${resultsTable} (
          match,
          red_score,
          blue_score,
          red_penalty_committed,
          blue_penalty_committed
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        matchNumber,
        parsePositiveInteger(record.redScore, 0),
        parsePositiveInteger(record.blueScore, 0),
        parsePositiveInteger(record.redPenalty, 0),
        parsePositiveInteger(record.bluePenalty, 0)
      );

    let dataTable: string;
    if (matchType === "practice") {
      dataTable = "practice_data";
    } else if (matchType === "quals") {
      dataTable = "quals_data";
    } else {
      dataTable = "elims_data";
    }

    const updatePostedTimeColumn =
      dataTable === "elims_data"
        ? `UPDATE ${dataTable} SET status = ?, posted_time = ?, start = ? WHERE match = ?`
        : `UPDATE ${dataTable} SET status = ?, posted_time = ?, start = ?, schedule_start = COALESCE(schedule_start, ?) WHERE match = ?`;
    if (dataTable === "elims_data") {
      eventDb
        .query(updatePostedTimeColumn)
        .run(
          resolveMatchStatus(record.status),
          postedTime,
          playedAt,
          matchNumber
        );
    } else {
      eventDb
        .query(updatePostedTimeColumn)
        .run(
          resolveMatchStatus(record.status),
          postedTime,
          playedAt,
          playedAt,
          matchNumber
        );
    }

    const details =
      record.details && typeof record.details === "object"
        ? (record.details as {
            blueAlliance?: Record<string, unknown>;
            redAlliance?: Record<string, unknown>;
          })
        : null;

    let gameSpecificTable:
      | "quals_game_specific"
      | "elims_game_specific"
      | "practice_game_specific";
    if (matchType === "practice") {
      gameSpecificTable = "practice_game_specific";
    } else if (matchType === "quals") {
      gameSpecificTable = "quals_game_specific";
    } else {
      gameSpecificTable = "elims_game_specific";
    }

    let historyTable:
      | "quals_game_specific_history"
      | "elims_game_specific_history"
      | "practice_game_specific_history";
    if (matchType === "practice") {
      historyTable = "practice_game_specific_history";
    } else if (matchType === "quals") {
      historyTable = "quals_game_specific_history";
    } else {
      historyTable = "elims_game_specific_history";
    }

    if (details?.redAlliance && details.blueAlliance) {
      ensureGameSpecificTables(eventDb, gameSpecificTable, historyTable);
      const alliances = [
        { value: 0, details: details.redAlliance },
        { value: 1, details: details.blueAlliance },
      ];

      for (const alliance of alliances) {
        const row = alliance.details;
        eventDb
          .query(
            `DELETE FROM ${gameSpecificTable} WHERE match = ? AND alliance = ?`
          )
          .run(matchNumber, alliance.value);
        eventDb
          .query(
            `INSERT INTO ${gameSpecificTable} (
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
            alliance.value,
            parsePositiveInteger(row.aSecondTierFlags, 0),
            parsePositiveInteger(row.aFirstTierFlags, 0),
            parsePositiveInteger(row.aCenterFlags, 0),
            parsePositiveInteger(row.bCenterFlagDown, 0),
            parsePositiveInteger(row.bBaseFlagsDown, 0),
            parsePositiveInteger(row.cOpponentBackfieldBullets, 0),
            parsePositiveInteger(row.dRobotParkState, 0),
            parsePositiveInteger(row.dGoldFlagsDefended, 0),
            parsePositiveInteger(row.scoreA, 0),
            parsePositiveInteger(row.scoreB, 0),
            parsePositiveInteger(row.scoreC, 0),
            parsePositiveInteger(row.scoreD, 0),
            parsePositiveInteger(row.scoreTotal, 0)
          );
        eventDb
          .query(
            `INSERT INTO ${historyTable} (
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
            playedAt,
            alliance.value,
            parsePositiveInteger(row.aSecondTierFlags, 0),
            parsePositiveInteger(row.aFirstTierFlags, 0),
            parsePositiveInteger(row.aCenterFlags, 0),
            parsePositiveInteger(row.bCenterFlagDown, 0),
            parsePositiveInteger(row.bBaseFlagsDown, 0),
            parsePositiveInteger(row.cOpponentBackfieldBullets, 0),
            parsePositiveInteger(row.dRobotParkState, 0),
            parsePositiveInteger(row.dGoldFlagsDefended, 0),
            parsePositiveInteger(row.scoreA, 0),
            parsePositiveInteger(row.scoreB, 0),
            parsePositiveInteger(row.scoreC, 0),
            parsePositiveInteger(row.scoreD, 0),
            parsePositiveInteger(row.scoreTotal, 0)
          );
      }
    } else if (tableExists(eventDb, gameSpecificTable)) {
      eventDb
        .query(`DELETE FROM ${gameSpecificTable} WHERE match = ?`)
        .run(matchNumber);
    }

    notifications.scoringUpdates.push({ matchNumber, matchType });
    if (matchType === "quals") {
      notifications.rankingUpdated = true;
    }
  }
};

const formatSortOrderValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(3);
};

const applyTeamRankingsSnapshot = (
  eventDb: Database,
  eventCode: string,
  teamDirectory: EventTeamDirectoryEntry[],
  records: SyncRecord[],
  notifications: ApplyNotifications
): void => {
  const fmsEventId = getExistingEventId(eventDb) || eventCode;
  const teamIdByNumber = new Map(
    teamDirectory.map((team) => [team.teamNumber, team.fmsTeamId])
  );

  eventDb.query("DELETE FROM team_ranking").run();

  const insert = eventDb.query(
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

  for (const record of records) {
    const teamNumber = String(record.teamNumber);
    const sortOrders = Array.isArray(record.sortOrders)
      ? (record.sortOrders as number[])
      : [];

    insert.run(
      fmsEventId,
      teamIdByNumber.get(teamNumber) || buildSyntheticFmsTeamId(teamNumber),
      parsePositiveInteger(record.rank, 0),
      parsePositiveInteger(record.rankChange, 0),
      parsePositiveInteger(record.wins, 0),
      parsePositiveInteger(record.losses, 0),
      parsePositiveInteger(record.ties, 0),
      formatSortOrderValue(
        typeof record.qualifyingScore === "number" ? record.qualifyingScore : 0
      ),
      typeof record.pointsScoredTotal === "number"
        ? record.pointsScoredTotal
        : 0,
      formatSortOrderValue(
        typeof record.pointsScoredAverage === "number"
          ? record.pointsScoredAverage
          : 0
      ),
      0,
      parsePositiveInteger(record.matchesPlayed, 0),
      parsePositiveInteger(record.matchesPlayed, 0),
      0,
      formatSortOrderValue(sortOrders[0] ?? record.qualifyingScore ?? 0),
      formatSortOrderValue(sortOrders[1] ?? record.pointsScoredAverage ?? 0),
      formatSortOrderValue(sortOrders[2] ?? record.pointsScoredTotal ?? 0),
      formatSortOrderValue(sortOrders[3] ?? Number(teamNumber)),
      formatSortOrderValue(sortOrders[4] ?? 0),
      formatSortOrderValue(sortOrders[5] ?? 0),
      typeof record.modifiedAt === "string"
        ? record.modifiedAt
        : new Date().toISOString()
    );
  }

  notifications.rankingUpdated = true;
};

const applyTeamAwardsSnapshot = (
  eventDb: Database,
  eventCode: string,
  teamDirectory: EventTeamDirectoryEntry[],
  records: SyncRecord[]
): void => {
  const fmsEventId = getExistingEventId(eventDb) || eventCode;
  const teamIdByNumber = new Map(
    teamDirectory.map((team) => [team.teamNumber, team.fmsTeamId])
  );

  eventDb.query("DELETE FROM award_assignment").run();
  eventDb.query("DELETE FROM award").run();

  const awardInsert = eventDb.query(
    `INSERT INTO award (
      fms_award_id,
      fms_season_id,
      award_id,
      award_subtype_id,
      tournament_type,
      type,
      culture_type,
      description,
      default_quantity,
      sponsor_details,
      display_order_ui,
      display_order_online,
      cmp_qualifying,
      allow_manual_entry,
      created_on,
      created_by,
      modified_on,
      modified_by,
      script,
      can_edit
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const assignmentInsert = eventDb.query(
    `INSERT INTO award_assignment (
      fms_award_id,
      fms_event_id,
      series,
      fms_team_id,
      first_name,
      last_name,
      is_public,
      created_on,
      created_by,
      modified_on,
      modified_by,
      comment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const awardCode = String(record.awardCode);
    const displayOrder = parsePositiveInteger(record.displayOrder, index + 1);
    const timestamp =
      typeof record.assignedAt === "string"
        ? record.assignedAt
        : new Date().toISOString();
    const awardId = `SYNC_AWARD_${awardCode}`;

    awardInsert.run(
      awardId,
      SYNC_SEASON,
      displayOrder,
      0,
      0,
      0,
      0,
      String(record.awardName),
      null,
      null,
      displayOrder,
      displayOrder,
      0,
      1,
      timestamp,
      "sync-api",
      timestamp,
      "sync-api",
      "",
      1
    );

    assignmentInsert.run(
      awardId,
      fmsEventId,
      1,
      typeof record.teamNumber === "string"
        ? teamIdByNumber.get(record.teamNumber) ||
            buildSyntheticFmsTeamId(record.teamNumber)
        : null,
      typeof record.recipient === "string" ? record.recipient : null,
      null,
      toBooleanInt(record.isPublic),
      timestamp,
      "sync-api",
      timestamp,
      "sync-api",
      typeof record.comment === "string" ? record.comment : null
    );
  }
};

const publishNotifications = (
  eventCode: string,
  notifications: ApplyNotifications
): void => {
  for (const teamNumber of notifications.inspectionTeamNumbers) {
    inspectionSyncHub.publish({
      eventCode,
      kind: "STATUS_UPDATED",
      teamNumber,
    });
  }

  for (const update of notifications.scoringUpdates) {
    scoringSyncHub.publish({
      eventCode,
      kind: "SCORE_UPDATED",
      matchNumber: update.matchNumber,
      matchType: update.matchType,
    });
  }

  if (notifications.rankingUpdated) {
    qualificationRankingsSyncHub.publish({
      eventCode,
      kind: "RANKINGS_UPDATED",
    });
  }
};

export const applySyncChangeSetsToEventDb = (
  eventCode: string,
  changeSets: StagedSyncChangeSet[]
): void => {
  const notifications: ApplyNotifications = {
    inspectionTeamNumbers: new Set<number>(),
    rankingUpdated: false,
    scoringUpdates: [],
  };

  withEventDb(eventCode, (eventDb) => {
    const teamDirectory = loadEventTeamDirectoryFromDb(eventDb);

    eventDb.exec("BEGIN TRANSACTION");
    try {
      for (const changeSet of changeSets) {
        if (changeSet.resourceType === "inspection_schedule") {
          applyInspectionScheduleSnapshot(eventDb, changeSet.records);
          continue;
        }

        if (changeSet.resourceType === "inspection_results") {
          applyInspectionResults(eventDb, changeSet.records, notifications);
          continue;
        }

        if (changeSet.resourceType === "match_schedule") {
          applyMatchScheduleSnapshot(eventDb, changeSet.records);
          continue;
        }

        if (changeSet.resourceType === "match_results") {
          applyMatchResults(eventDb, changeSet.records, notifications);
          continue;
        }

        if (changeSet.resourceType === "team_rankings") {
          applyTeamRankingsSnapshot(
            eventDb,
            eventCode,
            teamDirectory,
            changeSet.records,
            notifications
          );
          continue;
        }

        if (changeSet.resourceType === "team_awards") {
          applyTeamAwardsSnapshot(
            eventDb,
            eventCode,
            teamDirectory,
            changeSet.records
          );
        }
      }

      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });

  publishNotifications(eventCode, notifications);
};
