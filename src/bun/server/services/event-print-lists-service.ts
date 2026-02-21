import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { and, asc, eq } from "drizzle-orm";
import { DATA_DIR, db, schema } from "../../db";
import { ServiceError } from "./manual-event-service";

export interface PrintableAccountItem {
  password: string | null;
  role: string;
  username: string;
}

export interface PrintableTeamItem {
  location: string;
  name: string;
  teamNumber: number;
}

export interface PrintableMatchItem {
  blueScore: number;
  fieldType: number;
  matchId: string;
  playNumber: number;
  redScore: number;
  startTime: string;
}

export interface PrintableScheduleItem {
  description: string;
  matchNumber: number | null;
  stage: string;
  startTime: string;
}

export interface EventPrintListsResponse {
  accounts: PrintableAccountItem[];
  eventCode: string;
  generatedAt: string;
  matches: PrintableMatchItem[];
  schedules: PrintableScheduleItem[];
  teams: PrintableTeamItem[];
}

interface TeamRow {
  city: string;
  country: string;
  teamNameLong: string | null;
  teamNameShort: string;
  teamNumber: number;
}

interface TeamFallbackRow {
  advancement: number;
  competing: string;
  division: number;
  teamNumber: number;
}

interface MatchRow {
  blueScore: number;
  fieldType: number;
  matchId: string;
  playNumber: number;
  redScore: number;
  startTime: string | null;
}

interface MatchFallbackRow {
  blue1: number;
  blue2: number;
  matchNumber: number;
  red1: number;
  red2: number;
}

interface ScheduleRow {
  description: string;
  matchNumber: number;
  startTime: string;
  tournamentLevel: number;
}

interface MatchScheduleFallbackRow {
  end: number;
  label: string;
  start: number;
  type: number;
}

const toPrintableDateTime = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) {
    return "";
  }

  const rawValue =
    typeof value === "number"
      ? (() => {
          const parsed = new Date(value);
          if (Number.isNaN(parsed.getTime())) {
            return String(value);
          }
          return parsed.toISOString();
        })()
      : String(value);
  if (!rawValue) {
    return "";
  }

  const parsedDate = new Date(rawValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return rawValue;
  }

  return parsedDate.toISOString();
};

const mapTournamentLevel = (value: number): string => {
  if (value === 1) {
    return "Practice";
  }

  if (value === 2) {
    return "Qualification";
  }

  if (value === 3) {
    return "Playoff";
  }

  return `Level ${value}`;
};

const tableExists = (eventDb: Database, tableName: string): boolean => {
  const row = eventDb
    .query(
      "SELECT 1 AS has_table FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
    )
    .get(tableName) as { has_table: number } | null;

  return Boolean(row?.has_table);
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

const listAccounts = (eventCode: string): PrintableAccountItem[] =>
  db
    .select({
      username: schema.roles.username,
      role: schema.roles.role,
      password: schema.accountSecrets.secret,
    })
    .from(schema.roles)
    .leftJoin(
      schema.accountSecrets,
      and(
        eq(schema.roles.username, schema.accountSecrets.username),
        eq(schema.roles.event, schema.accountSecrets.event)
      )
    )
    .where(eq(schema.roles.event, eventCode))
    .orderBy(asc(schema.roles.username), asc(schema.roles.role))
    .all()
    .map((row) => ({
      username: row.username,
      role: row.role,
      password: row.password ?? null,
    }));

const listTeams = (eventDb: Database): PrintableTeamItem[] => {
  if (tableExists(eventDb, "team")) {
    const rows = eventDb
      .query(
        "SELECT team_number AS teamNumber, team_name_short AS teamNameShort, team_name_long AS teamNameLong, city AS city, country AS country FROM team ORDER BY team_number ASC"
      )
      .all() as TeamRow[];

    return rows.map((row) => ({
      teamNumber: row.teamNumber,
      name: row.teamNameLong || row.teamNameShort,
      location: [row.city, row.country].filter(Boolean).join(", "),
    }));
  }

  if (tableExists(eventDb, "teams")) {
    const rows = eventDb
      .query(
        "SELECT number AS teamNumber, competing AS competing, advancement AS advancement, division AS division FROM teams ORDER BY number ASC"
      )
      .all() as TeamFallbackRow[];

    return rows.map((row) => ({
      teamNumber: row.teamNumber,
      name: `Team ${row.teamNumber}`,
      location: `Division ${row.division} | Adv ${row.advancement} | Competing ${row.competing}`,
    }));
  }

  return [];
};

const listMatches = (eventDb: Database): PrintableMatchItem[] => {
  if (tableExists(eventDb, "match")) {
    const rows = eventDb
      .query(
        'SELECT fms_match_id AS matchId, play_number AS playNumber, field_type AS fieldType, red_score AS redScore, blue_score AS blueScore, auto_start_time AS startTime FROM "match" ORDER BY play_number ASC'
      )
      .all() as MatchRow[];

    return rows.map((row) => ({
      matchId: row.matchId,
      playNumber: row.playNumber,
      fieldType: row.fieldType,
      redScore: row.redScore,
      blueScore: row.blueScore,
      startTime: toPrintableDateTime(row.startTime),
    }));
  }

  if (tableExists(eventDb, "quals")) {
    const rows = eventDb
      .query(
        "SELECT match AS matchNumber, red1 AS red1, red2 AS red2, blue1 AS blue1, blue2 AS blue2 FROM quals ORDER BY match ASC"
      )
      .all() as MatchFallbackRow[];

    return rows.map((row) => ({
      matchId: `Q${row.matchNumber}`,
      playNumber: row.matchNumber,
      fieldType: 0,
      redScore: 0,
      blueScore: 0,
      startTime: `Red: ${row.red1}/${row.red2} Blue: ${row.blue1}/${row.blue2}`,
    }));
  }

  return [];
};

const listSchedules = (eventDb: Database): PrintableScheduleItem[] => {
  if (tableExists(eventDb, "schedule_detail")) {
    const rows = eventDb
      .query(
        "SELECT tournament_level AS tournamentLevel, match_number AS matchNumber, description AS description, start_time AS startTime FROM schedule_detail ORDER BY start_time ASC, match_number ASC"
      )
      .all() as ScheduleRow[];

    return rows.map((row) => ({
      stage: mapTournamentLevel(row.tournamentLevel),
      matchNumber: row.matchNumber,
      description: row.description,
      startTime: toPrintableDateTime(row.startTime),
    }));
  }

  const scheduleItems: PrintableScheduleItem[] = [];

  if (tableExists(eventDb, "practice_match_schedule")) {
    const rows = eventDb
      .query(
        "SELECT start AS start, end AS end, type AS type, label AS label FROM practice_match_schedule ORDER BY start ASC"
      )
      .all() as MatchScheduleFallbackRow[];

    for (const row of rows) {
      scheduleItems.push({
        stage: "Practice",
        matchNumber: null,
        description: `${row.label} (type ${row.type})`,
        startTime: `${toPrintableDateTime(row.start)} - ${toPrintableDateTime(row.end)}`,
      });
    }
  }

  if (tableExists(eventDb, "match_schedule")) {
    const rows = eventDb
      .query(
        "SELECT start AS start, end AS end, type AS type, label AS label FROM match_schedule ORDER BY start ASC"
      )
      .all() as MatchScheduleFallbackRow[];

    for (const row of rows) {
      scheduleItems.push({
        stage: "Qualification",
        matchNumber: null,
        description: `${row.label} (type ${row.type})`,
        startTime: `${toPrintableDateTime(row.start)} - ${toPrintableDateTime(row.end)}`,
      });
    }
  }

  return scheduleItems;
};

export const getEventPrintLists = (
  eventCode: string
): EventPrintListsResponse => {
  const normalizedEventCode = eventCode.trim();
  if (!normalizedEventCode) {
    throw new ServiceError("Event code is required.", 400);
  }

  assertEventExists(normalizedEventCode);

  const accounts = listAccounts(normalizedEventCode);

  const { matches, schedules, teams } = withEventDb(
    normalizedEventCode,
    (eventDb) => ({
      teams: listTeams(eventDb),
      matches: listMatches(eventDb),
      schedules: listSchedules(eventDb),
    })
  );

  return {
    eventCode: normalizedEventCode,
    generatedAt: new Date().toISOString(),
    accounts,
    teams,
    matches,
    schedules,
  };
};
