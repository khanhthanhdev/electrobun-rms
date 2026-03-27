import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { getDataDir, resetForTest } from "../../../db";

const scheduleTestRunId = process.env.SCHEDULE_TEST_RUN_ID ?? `${process.pid}`;
process.env.SCHEDULE_TEST_RUN_ID = scheduleTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-schedule-tests-${scheduleTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

// Reset database connection to pick up new ELECTROBUN_DATA_DIR
resetForTest();

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const scheduleRoutesModule = await import("./schedule.routes");

export const { db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { scheduleRoutes } = scheduleRoutesModule;

interface ScheduleTeamSeed {
  name?: string;
  teamNumber: number;
}

export async function resetScheduleTestDatabase(): Promise<void> {
  await resetDatabase();

  for (const fileName of readdirSync(TEST_DATA_DIR)) {
    if (fileName.endsWith(".db") && fileName !== "server.db") {
      rmSync(join(TEST_DATA_DIR, fileName), { force: true });
    }
  }
}

export function createScheduleTestApp(): Hono {
  const app = new Hono();
  app.route("/", scheduleRoutes);
  return app;
}

export function insertEvent(eventCode: string, fields = 2): void {
  db.insert(schema.events)
    .values({
      code: eventCode,
      divisions: 1,
      end: Date.parse("2026-03-24T00:00:00.000Z"),
      fields,
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

export function createScheduleEventDb(
  eventCode: string,
  teams: ScheduleTeamSeed[]
): string {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);

  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
    eventDb.exec(`CREATE TABLE teams (
      number INTEGER NOT NULL PRIMARY KEY,
      advancement INTEGER NOT NULL,
      division INTEGER NOT NULL,
      inspire_eligible INTEGER NOT NULL,
      promote_eligible INTEGER NOT NULL,
      competing TEXT NOT NULL
    )`);
    eventDb.exec(`CREATE TABLE team_metadata (
      team_number INTEGER NOT NULL PRIMARY KEY,
      team_name TEXT NOT NULL DEFAULT '',
      organization_school TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`);

    for (const team of teams) {
      const teamName = team.name ?? `Team ${team.teamNumber}`;
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
        .run(team.teamNumber, 0, 1, 1, 1, "Y");
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
          teamName,
          `Org ${team.teamNumber}`,
          "",
          "",
          Date.now()
        );
    }
  } finally {
    eventDb.close();
  }

  return eventDbPath;
}
