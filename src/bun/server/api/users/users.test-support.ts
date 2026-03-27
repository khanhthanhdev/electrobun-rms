import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";

const usersTestRunId = process.env.USERS_TEST_RUN_ID ?? `${process.pid}`;
process.env.USERS_TEST_RUN_ID = usersTestRunId;

export const TEST_DATA_DIR = join(
  tmpdir(),
  `electrobun-users-tests-${usersTestRunId}`
);

mkdirSync(TEST_DATA_DIR, { recursive: true });
process.env.ELECTROBUN_DATA_DIR = TEST_DATA_DIR;

const dbModule = await import("../../../db");
const migrateModule = await import("../../../db/migrate");
const authServiceModule = await import("../auth/auth.service");
const usersRoutesModule = await import("./users.routes");

export const { db, schema } = dbModule;
export const { resetDatabase } = migrateModule;
export const { issueAccessToken } = authServiceModule;
export const { usersRoutes } = usersRoutesModule;

interface TestRoleAssignment {
  event: string;
  role: (typeof schema.ROLE_VALUES)[number];
}

export async function resetUsersTestDatabase(): Promise<void> {
  await resetDatabase();
}

export function createUsersTestApp(): Hono {
  const app = new Hono();
  app.route("/", usersRoutes);
  return app;
}

export function createToken(input: {
  roles: TestRoleAssignment[];
  type?: number;
  username?: string;
}): Promise<string> {
  return issueAccessToken({
    username: input.username ?? "admin",
    type: input.type ?? 0,
    roles: input.roles,
  });
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

export async function insertUser(input: {
  generic?: boolean;
  password?: string;
  roles?: TestRoleAssignment[];
  type?: number;
  used?: boolean;
  username: string;
}): Promise<void> {
  const hashedPassword = await Bun.password.hash(
    input.password ?? "secret123",
    {
      algorithm: "bcrypt",
      cost: 10,
    }
  );

  db.insert(schema.users)
    .values({
      username: input.username,
      hashedPassword,
      type: input.type ?? 0,
      used: input.used ?? true,
      generic: input.generic ?? false,
    })
    .run();

  if ((input.roles?.length ?? 0) > 0) {
    db.insert(schema.roles)
      .values(
        (input.roles ?? []).map((role) => ({
          username: input.username,
          role: role.role,
          event: role.event,
        }))
      )
      .run();
  }
}

export async function getStoredUserSnapshot(username: string): Promise<{
  roles: Array<{ event: string; role: string }>;
  user: {
    generic: boolean;
    hashedPassword: string;
    type: number;
    used: boolean;
    username: string;
  } | null;
}> {
  const [user] = await db
    .select({
      generic: schema.users.generic,
      hashedPassword: schema.users.hashedPassword,
      type: schema.users.type,
      used: schema.users.used,
      username: schema.users.username,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
    .all();

  const roles = await db
    .select({ event: schema.roles.event, role: schema.roles.role })
    .from(schema.roles)
    .where(eq(schema.roles.username, username))
    .orderBy(asc(schema.roles.role), asc(schema.roles.event))
    .all();

  return {
    user: user ?? null,
    roles,
  };
}
