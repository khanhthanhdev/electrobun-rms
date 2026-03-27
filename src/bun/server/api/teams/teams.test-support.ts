import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { getDataDir, resetForTest } from "../../../db";

const teamsTestRunId = process.env.TEAMS_TEST_RUN_ID ?? `${process.pid}`;
process.env.TEAMS_TEST_RUN_ID = teamsTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-teams-tests-${teamsTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

// Reset database connection to pick up new ELECTROBUN_DATA_DIR
resetForTest();

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const teamsRoutesModule = await import("./teams.routes");

export const { db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { teamsRoutes } = teamsRoutesModule;

interface LegacyTeamSeed {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamNameLong?: string | null;
  teamNameShort?: string;
  teamNumber: number;
}

interface TeamMetadataSeed {
  city?: string;
  country?: string;
  organizationSchool?: string;
  teamName?: string;
  teamNumber: number;
}

interface TeamsRowSeed {
  advancement?: number;
  division?: number;
  teamNumber: number;
}

export async function resetTeamsTestDatabase(): Promise<void> {
  await resetDatabase();

  for (const fileName of readdirSync(TEST_DATA_DIR)) {
    if (fileName.endsWith(".db") && fileName !== "server.db") {
      rmSync(join(TEST_DATA_DIR, fileName), { force: true });
    }
  }
}

export function createTeamsTestApp(): Hono {
  const app = new Hono();
  app.route("/", teamsRoutes);
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

export async function createAdminToken(eventCode = "*"): Promise<string> {
  return await issueAccessToken({
    username: "admin",
    type: 0,
    roles: [{ role: "ADMIN", event: eventCode }],
  });
}

const seedTeamsRows = (eventDb: Database, teamsRows: TeamsRowSeed[]): void => {
  eventDb.exec(`CREATE TABLE teams (
    number INTEGER NOT NULL PRIMARY KEY,
    advancement INTEGER NOT NULL,
    division INTEGER NOT NULL,
    inspire_eligible INTEGER NOT NULL,
    promote_eligible INTEGER NOT NULL,
    competing TEXT NOT NULL
  )`);

  for (const team of teamsRows) {
    eventDb
      .query(
        `INSERT INTO teams (
          number,
          advancement,
          division,
          inspire_eligible,
          promote_eligible,
          competing
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        team.teamNumber,
        team.advancement ?? 0,
        team.division ?? 1,
        1,
        1,
        "Y"
      );
  }
};

const seedMetadataTeams = (
  eventDb: Database,
  metadataTeams: TeamMetadataSeed[]
): void => {
  eventDb.exec(`CREATE TABLE team_metadata (
    team_number INTEGER NOT NULL PRIMARY KEY,
    team_name TEXT NOT NULL DEFAULT '',
    organization_school TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL DEFAULT 0
  )`);

  for (const team of metadataTeams) {
    eventDb
      .query(
        `INSERT INTO team_metadata (
          team_number,
          team_name,
          organization_school,
          city,
          country,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        team.teamNumber,
        team.teamName ?? "",
        team.organizationSchool ?? "",
        team.city ?? "",
        team.country ?? "",
        Date.now()
      );
  }
};

const seedLegacyTeams = (
  eventDb: Database,
  legacyTeams: LegacyTeamSeed[]
): void => {
  eventDb.exec(`CREATE TABLE team (
    team_number INTEGER NOT NULL PRIMARY KEY,
    team_name_short TEXT NOT NULL,
    team_name_long TEXT,
    school_name TEXT,
    city TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT ''
  )`);

  for (const team of legacyTeams) {
    eventDb
      .query(
        `INSERT INTO team (
          team_number,
          team_name_short,
          team_name_long,
          school_name,
          city,
          country
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        team.teamNumber,
        team.teamNameShort ?? `Team ${team.teamNumber}`,
        team.teamNameLong ?? null,
        team.organizationSchool ?? "",
        team.city ?? "",
        team.country ?? ""
      );
  }
};

export function createTeamsEventDb(
  eventCode: string,
  options: {
    legacyTeams?: LegacyTeamSeed[];
    metadataTeams?: TeamMetadataSeed[];
    teamsRows?: TeamsRowSeed[];
  } = {}
): string {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);

  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
    if ((options.teamsRows?.length ?? 0) > 0) {
      seedTeamsRows(eventDb, options.teamsRows ?? []);
    }

    if ((options.metadataTeams?.length ?? 0) > 0) {
      seedMetadataTeams(eventDb, options.metadataTeams ?? []);
    }

    if ((options.legacyTeams?.length ?? 0) > 0) {
      seedLegacyTeams(eventDb, options.legacyTeams ?? []);
    }
  } finally {
    eventDb.close();
  }

  return eventDbPath;
}

export function readStoredTeamSnapshot(
  eventCode: string,
  teamNumber: number
): {
  legacyTeam: Record<string, unknown> | null;
  metadataTeam: Record<string, unknown> | null;
  teamsRow: Record<string, unknown> | null;
} {
  const eventDb = new Database(join(getDataDir(), `${eventCode}.db`), {
    readonly: true,
  });

  try {
    const hasTable = (tableName: string): boolean =>
      Boolean(
        eventDb
          .query(
            "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1"
          )
          .get(tableName)
      );
    const teamsRow = hasTable("teams")
      ? (eventDb
          .query(
            "SELECT number, advancement, division FROM teams WHERE number = ? LIMIT 1"
          )
          .get(teamNumber) as Record<string, unknown> | null)
      : null;
    const metadataTeam = hasTable("team_metadata")
      ? (eventDb
          .query(
            "SELECT team_number, team_name, organization_school, city, country FROM team_metadata WHERE team_number = ? LIMIT 1"
          )
          .get(teamNumber) as Record<string, unknown> | null)
      : null;
    const legacyTeam = hasTable("team")
      ? (eventDb
          .query(
            "SELECT team_number, team_name_short, team_name_long, school_name, city, country FROM team WHERE team_number = ? LIMIT 1"
          )
          .get(teamNumber) as Record<string, unknown> | null)
      : null;

    return {
      legacyTeam,
      metadataTeam,
      teamsRow,
    };
  } finally {
    eventDb.close();
  }
}
