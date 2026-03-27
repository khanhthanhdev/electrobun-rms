import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { getDataDir, resetForTest } from "../../../db";

const eventsTestRunId = process.env.EVENTS_TEST_RUN_ID ?? `${process.pid}`;
process.env.EVENTS_TEST_RUN_ID = eventsTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-events-tests-${eventsTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

// Reset database connection to pick up new ELECTROBUN_DATA_DIR
resetForTest();

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const eventsRoutesModule = await import("./events.routes");
const rankingsSyncModule = await import("./rankings-sync");

export const { db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { eventsRoutes } = eventsRoutesModule;
export const {
  QUALIFICATION_RANKINGS_SYNC_EVENT_NAME,
  qualificationRankingsSyncHub,
} = rankingsSyncModule;

interface RankingTeamSeed {
  fmsTeamId?: string;
  name?: string;
  teamNumber: number;
}

interface RankingMatchSeed {
  bluePenaltyCommitted?: number;
  blueScore: number;
  blueSurrogate?: number;
  blueTeam: number;
  matchNumber: number;
  postedTime?: number;
  redPenaltyCommitted?: number;
  redScore: number;
  redSurrogate?: number;
  redTeam: number;
}

interface StoredRankingSeed {
  losses: number;
  name?: string;
  played: number;
  rank: number;
  rankingPoint: number;
  teamNumber: number;
  ties: number;
  total: number;
  wins: number;
}

interface PrintListAccountSeed {
  password: string;
  role: string;
  username: string;
}

interface PrintListTeamSeed {
  city?: string;
  country?: string;
  teamNameLong?: string | null;
  teamNameShort: string;
  teamNumber: number;
}

interface PrintListMatchSeed {
  blueScore: number;
  fieldType: number;
  matchId: string;
  playNumber: number;
  redScore: number;
  startTime: string;
}

interface PrintListScheduleSeed {
  description: string;
  matchNumber: number;
  startTime: string;
  tournamentLevel: number;
}

const buildSyntheticFmsTeamId = (teamNumber: number): string =>
  `LOCAL_TEAM_${teamNumber}`;

export const getEventDbPath = (eventCode: string): string =>
  join(getDataDir(), `${eventCode}.db`);

export async function resetEventsTestDatabase(): Promise<void> {
  await resetDatabase();

  for (const fileName of readdirSync(TEST_DATA_DIR)) {
    if (fileName.endsWith(".db") && fileName !== "server.db") {
      rmSync(join(TEST_DATA_DIR, fileName), { force: true });
    }
  }
}

export function createEventsTestApp(): Hono {
  const app = new Hono();
  app.route("/", eventsRoutes);
  return app;
}

export function insertEvent(eventCode: string): void {
  db.insert(schema.events)
    .values({
      code: eventCode,
      divisions: 1,
      end: Date.parse("2026-03-24T00:00:00.000Z"),
      fields: 1,
      finals: 1,
      name: `Event ${eventCode}`,
      region: "Test Region",
      start: Date.parse("2026-03-23T00:00:00.000Z"),
      status: 1,
      type: 1,
    })
    .run();
}

export function readStoredEvent(eventCode: string) {
  const [event] = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .limit(1)
    .all();

  return event ?? null;
}

export function eventDbExists(eventCode: string): boolean {
  return existsSync(getEventDbPath(eventCode));
}

export function seedPrintableAccount(
  eventCode: string,
  account: PrintListAccountSeed
): void {
  db.insert(schema.users)
    .values({
      username: account.username,
      hashedPassword: "hash",
      type: 0,
      used: true,
      generic: true,
    })
    .run();

  db.insert(schema.roles)
    .values({
      username: account.username,
      role: account.role,
      event: eventCode,
    })
    .run();

  db.insert(schema.accountSecrets)
    .values({
      username: account.username,
      event: eventCode,
      secret: account.password,
      createdAt: Date.now(),
    })
    .run();
}

export async function createAdminToken(eventCode = "*"): Promise<string> {
  return await issueAccessToken({
    username: "admin",
    type: 0,
    roles: [{ role: "ADMIN", event: eventCode }],
  });
}

export function createRankingEventDb(
  eventCode: string,
  options: {
    matches?: RankingMatchSeed[];
    storedRankings?: StoredRankingSeed[];
    teams?: RankingTeamSeed[];
  } = {}
): string {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);
  const teams = options.teams ?? [];
  const teamByNumber = new Map(teams.map((team) => [team.teamNumber, team]));

  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
    eventDb.exec(`CREATE TABLE team (
      fms_team_id TEXT,
      team_number INTEGER NOT NULL,
      team_name_long TEXT,
      team_name_short TEXT
    )`);
    eventDb.exec(`CREATE TABLE team_metadata (
      team_number INTEGER NOT NULL,
      team_name TEXT,
      organization_school TEXT,
      city TEXT,
      country TEXT
    )`);
    eventDb.exec(`CREATE TABLE quals (
      match INTEGER NOT NULL PRIMARY KEY,
      red INTEGER NOT NULL,
      blue INTEGER NOT NULL,
      reds INTEGER NOT NULL DEFAULT 0,
      blues INTEGER NOT NULL DEFAULT 0
    )`);
    eventDb.exec(`CREATE TABLE quals_data (
      match INTEGER NOT NULL PRIMARY KEY,
      posted_time INTEGER NOT NULL DEFAULT 0
    )`);
    eventDb.exec(`CREATE TABLE quals_results (
      match INTEGER NOT NULL PRIMARY KEY,
      red_score INTEGER NOT NULL,
      blue_score INTEGER NOT NULL,
      red_penalty_committed INTEGER NOT NULL,
      blue_penalty_committed INTEGER NOT NULL
    )`);
    eventDb.exec(`CREATE TABLE team_ranking (
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
    )`);

    for (const team of teams) {
      const teamName = team.name ?? `Team ${team.teamNumber}`;
      const fmsTeamId =
        team.fmsTeamId ?? buildSyntheticFmsTeamId(team.teamNumber);
      eventDb
        .query(
          "INSERT INTO team (fms_team_id, team_number, team_name_long, team_name_short) VALUES (?, ?, ?, ?)"
        )
        .run(fmsTeamId, team.teamNumber, teamName, teamName);
      eventDb
        .query(
          "INSERT INTO team_metadata (team_number, team_name, organization_school, city, country) VALUES (?, ?, ?, ?, ?)"
        )
        .run(team.teamNumber, teamName, `Org ${team.teamNumber}`, "", "");
    }

    for (const match of options.matches ?? []) {
      eventDb
        .query(
          "INSERT INTO quals (match, red, blue, reds, blues) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          match.matchNumber,
          match.redTeam,
          match.blueTeam,
          match.redSurrogate ?? 0,
          match.blueSurrogate ?? 0
        );
      eventDb
        .query("INSERT INTO quals_data (match, posted_time) VALUES (?, ?)")
        .run(match.matchNumber, match.postedTime ?? Date.now());
      eventDb
        .query(
          "INSERT INTO quals_results (match, red_score, blue_score, red_penalty_committed, blue_penalty_committed) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          match.matchNumber,
          match.redScore,
          match.blueScore,
          match.redPenaltyCommitted ?? 0,
          match.bluePenaltyCommitted ?? 0
        );
    }

    for (const ranking of options.storedRankings ?? []) {
      const seededTeam = teamByNumber.get(ranking.teamNumber);
      const fmsTeamId =
        seededTeam?.fmsTeamId ?? buildSyntheticFmsTeamId(ranking.teamNumber);
      const average =
        ranking.played > 0
          ? (ranking.total / ranking.played).toFixed(3)
          : "0.000";
      eventDb
        .query(
          `INSERT INTO team_ranking (
            fms_event_id, fms_team_id, ranking, rank_change, wins, losses, ties,
            qualifying_score, points_scored_total, points_scored_average,
            points_scored_average_change, matches_played, matches_counted,
            disqualified, sort_order1, sort_order2, sort_order3, sort_order4,
            sort_order5, sort_order6, modified_on
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          eventCode,
          fmsTeamId,
          ranking.rank,
          0,
          ranking.wins,
          ranking.losses,
          ranking.ties,
          String(ranking.rankingPoint),
          ranking.total,
          average,
          0,
          ranking.played,
          ranking.played,
          0,
          String(ranking.rankingPoint),
          average,
          String(ranking.total),
          String(ranking.teamNumber).padStart(6, "0"),
          "0",
          "0",
          new Date().toISOString()
        );
    }
  } finally {
    eventDb.close();
  }

  return eventDbPath;
}

export function createPrintListsEventDb(
  eventCode: string,
  options: {
    matches?: PrintListMatchSeed[];
    schedules?: PrintListScheduleSeed[];
    teams?: PrintListTeamSeed[];
  } = {}
): string {
  const eventDbPath = getEventDbPath(eventCode);

  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
    eventDb.exec(`CREATE TABLE team (
      team_number INTEGER NOT NULL,
      team_name_short TEXT NOT NULL,
      team_name_long TEXT,
      city TEXT NOT NULL,
      country TEXT NOT NULL
    )`);
    eventDb.exec(`CREATE TABLE schedule_detail (
      tournament_level INTEGER NOT NULL,
      match_number INTEGER NOT NULL,
      description TEXT NOT NULL,
      start_time TEXT NOT NULL
    )`);
    eventDb.exec(`CREATE TABLE "match" (
      fms_match_id TEXT NOT NULL,
      play_number INTEGER NOT NULL,
      field_type INTEGER NOT NULL,
      red_score INTEGER NOT NULL,
      blue_score INTEGER NOT NULL,
      auto_start_time TEXT
    )`);

    for (const team of options.teams ?? []) {
      eventDb
        .query(
          "INSERT INTO team (team_number, team_name_short, team_name_long, city, country) VALUES (?, ?, ?, ?, ?)"
        )
        .run(
          team.teamNumber,
          team.teamNameShort,
          team.teamNameLong ?? null,
          team.city ?? "",
          team.country ?? ""
        );
    }

    for (const schedule of options.schedules ?? []) {
      eventDb
        .query(
          "INSERT INTO schedule_detail (tournament_level, match_number, description, start_time) VALUES (?, ?, ?, ?)"
        )
        .run(
          schedule.tournamentLevel,
          schedule.matchNumber,
          schedule.description,
          schedule.startTime
        );
    }

    for (const match of options.matches ?? []) {
      eventDb
        .query(
          'INSERT INTO "match" (fms_match_id, play_number, field_type, red_score, blue_score, auto_start_time) VALUES (?, ?, ?, ?, ?, ?)'
        )
        .run(
          match.matchId,
          match.playNumber,
          match.fieldType,
          match.redScore,
          match.blueScore,
          match.startTime
        );
    }
  } finally {
    eventDb.close();
  }

  return eventDbPath;
}
