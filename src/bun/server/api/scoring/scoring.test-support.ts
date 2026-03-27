import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { getDataDir, resetForTest } from "../../../db";

const scoringTestRunId = process.env.SCORING_TEST_RUN_ID ?? `${process.pid}`;
process.env.SCORING_TEST_RUN_ID = scoringTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-scoring-tests-${scoringTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

// Reset database connection to pick up new ELECTROBUN_DATA_DIR
resetForTest();

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const scoringRoutesModule = await import("./scoring.routes");
const scoringSyncModule = await import("./scoring-sync");

export const { db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { scoringRoutes } = scoringRoutesModule;
export const { SCORING_SYNC_EVENT_NAME, scoringSyncHub } = scoringSyncModule;

export async function resetScoringTestDatabase(): Promise<void> {
  await resetDatabase();

  for (const fileName of readdirSync(TEST_DATA_DIR)) {
    if (fileName.endsWith(".db") && fileName !== "server.db") {
      rmSync(join(TEST_DATA_DIR, fileName), { force: true });
    }
  }
}

export function createScoringTestApp(): Hono {
  const app = new Hono();
  app.route("/", scoringRoutes);
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

export function createScoringEventDb(
  eventCode: string,
  options: {
    bluePenaltyCommitted?: number;
    blueScore?: number;
    blueSurrogate?: number;
    blueTeam?: number;
    blueTeamName?: string;
    matchNumber?: number;
    redPenaltyCommitted?: number;
    redScore?: number;
    redSurrogate?: number;
    redTeam?: number;
    redTeamName?: string;
  } = {}
): string {
  const matchNumber = options.matchNumber ?? 1;
  const redTeam = options.redTeam ?? 111;
  const blueTeam = options.blueTeam ?? 222;
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);

  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
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
    eventDb.exec(`CREATE TABLE quals_results (
      match INTEGER NOT NULL,
      red_score INTEGER NOT NULL,
      blue_score INTEGER NOT NULL,
      red_penalty_committed INTEGER NOT NULL,
      blue_penalty_committed INTEGER NOT NULL
    )`);

    const insertTeam = eventDb.query(
      `INSERT INTO team_metadata (
        team_number,
        team_name,
        organization_school,
        city,
        country
      ) VALUES (?, ?, ?, ?, ?)`
    );
    insertTeam.run(
      redTeam,
      options.redTeamName ?? `Team ${redTeam}`,
      `Org ${redTeam}`,
      "",
      ""
    );
    insertTeam.run(
      blueTeam,
      options.blueTeamName ?? `Team ${blueTeam}`,
      `Org ${blueTeam}`,
      "",
      ""
    );

    eventDb
      .query(
        "INSERT INTO quals (match, red, blue, reds, blues) VALUES (?, ?, ?, ?, ?)"
      )
      .run(
        matchNumber,
        redTeam,
        blueTeam,
        options.redSurrogate ?? 0,
        options.blueSurrogate ?? 0
      );

    eventDb
      .query(
        `INSERT INTO quals_results (
          match,
          red_score,
          blue_score,
          red_penalty_committed,
          blue_penalty_committed
        ) VALUES (?, ?, ?, ?, ?)`
      )
      .run(
        matchNumber,
        options.redScore ?? 0,
        options.blueScore ?? 0,
        options.redPenaltyCommitted ?? 0,
        options.bluePenaltyCommitted ?? 0
      );
  } finally {
    eventDb.close();
  }

  return eventDbPath;
}
