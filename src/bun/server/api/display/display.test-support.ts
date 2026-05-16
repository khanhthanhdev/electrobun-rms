import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { Hono } from "hono";

const displayTestRunId = process.env.DISPLAY_TEST_RUN_ID ?? `${process.pid}`;
process.env.DISPLAY_TEST_RUN_ID = displayTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-display-tests-${displayTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const displayRoutesModule = await import("./display.routes");
const displaySettingsRoutesModule = await import("./display-settings.routes");
const displaySyncModule = await import("./display-sync");
const scoringSyncModule = await import("../scoring/scoring-sync");
const dbModule = await import("../../../db");

export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { displayRoutes } = displayRoutesModule;
export const { displaySettingsRoutes } = displaySettingsRoutesModule;
export const { DISPLAY_SYNC_EVENT_NAME } = displaySyncModule;
export const { scoringSyncHub } = scoringSyncModule;
export const { getDataDir } = dbModule;

export async function resetDisplayTestDatabase(): Promise<void> {
  await resetDatabase();
}

export function createDisplayTestApp(): Hono {
  const app = new Hono();
  app.route("/", displayRoutes);
  app.route("/", displaySettingsRoutes);
  return app;
}

export async function createAdminToken(eventCode = "*"): Promise<string> {
  return await issueAccessToken({
    username: "admin",
    type: 0,
    roles: [{ role: "ADMIN", event: eventCode }],
  });
}

export function createDisplayEventDb(eventCode: string): void {
  const eventDb = new Database(join(getDataDir(), `${eventCode}.db`));
  try {
    eventDb.exec(
      "CREATE TABLE IF NOT EXISTS config (key TEXT NOT NULL PRIMARY KEY, value TEXT)"
    );
  } finally {
    eventDb.close();
  }
}
