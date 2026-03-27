import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const displaySyncModule = await import("./display-sync");
const scoringSyncModule = await import("../scoring/scoring-sync");

export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { displayRoutes } = displayRoutesModule;
export const { DISPLAY_SYNC_EVENT_NAME } = displaySyncModule;
export const { scoringSyncHub } = scoringSyncModule;

export async function resetDisplayTestDatabase(): Promise<void> {
  await resetDatabase();
}

export function createDisplayTestApp(): Hono {
  const app = new Hono();
  app.route("/", displayRoutes);
  return app;
}

export async function createAdminToken(eventCode = "*"): Promise<string> {
  return await issueAccessToken({
    username: "admin",
    type: 0,
    roles: [{ role: "ADMIN", event: eventCode }],
  });
}
