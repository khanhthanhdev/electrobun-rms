import { Database } from "bun:sqlite";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { getDataDir, resetForTest } from "../../../db";
import type { RoleValue } from "../../../db/schema";

const inspectionTestRunId =
  process.env.INSPECTION_TEST_RUN_ID ?? `${process.pid}`;
process.env.INSPECTION_TEST_RUN_ID = inspectionTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-inspection-tests-${inspectionTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

// Reset database connection to pick up new ELECTROBUN_DATA_DIR
resetForTest();

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const inspectionRoutesModule = await import("./inspection.routes");
const inspectionSyncModule = await import("./inspection-sync");

export const { db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { inspectionRoutes } = inspectionRoutesModule;
export const { INSPECTION_SYNC_EVENT_NAME, inspectionSyncHub } =
  inspectionSyncModule;

interface InspectionTeamSeed {
  name?: string;
  teamNumber: number;
}

export async function resetInspectionTestDatabase(): Promise<void> {
  await resetDatabase();

  for (const fileName of readdirSync(TEST_DATA_DIR)) {
    if (fileName.endsWith(".db") && fileName !== "server.db") {
      rmSync(join(TEST_DATA_DIR, fileName), { force: true });
    }
  }
}

export function createInspectionTestApp(): Hono {
  const app = new Hono();
  app.route("/", inspectionRoutes);
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

export async function createInspectionToken(
  role: RoleValue,
  eventCode: string
): Promise<string> {
  return await issueAccessToken({
    username: role.toLowerCase(),
    type: 0,
    roles: [{ role, event: eventCode }],
  });
}

export function createInspectionEventDb(
  eventCode: string,
  teams: InspectionTeamSeed[]
): string {
  const eventDbPath = join(getDataDir(), `${eventCode}.db`);

  rmSync(eventDbPath, { force: true });

  const eventDb = new Database(eventDbPath);
  try {
    eventDb.exec(`CREATE TABLE team_metadata (
      team_number INTEGER NOT NULL PRIMARY KEY,
      team_name TEXT NOT NULL DEFAULT '',
      organization_school TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      updated_at INTEGER NOT NULL DEFAULT 0
    )`);

    for (const team of teams) {
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
          team.name ?? `Team ${team.teamNumber}`,
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
