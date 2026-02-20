import { eq } from "drizzle-orm";
import { sign } from "hono/jwt";
import { safeParse } from "valibot";
import { db, schema } from "../../../db";
import { JWT_SECRET_KEY, TOKEN_TTL_SECONDS } from "./auth.constants";
import type { AuthToken, LoginBody, RoleAssignment } from "./auth.schema";
import { roleAssignmentSchema } from "./auth.schema";

export interface AuthenticatedUser {
  roles: RoleAssignment[];
  type: number;
  username: string;
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const result = Buffer.from(bytes).toString("base64url");
  if (!result) {
    throw new Error("Failed to generate secret.");
  }
  return result;
}

export async function getJwtSecret(): Promise<string> {
  const candidateSecret = generateSecret();

  await db
    .insert(schema.config)
    .values({ key: JWT_SECRET_KEY, value: candidateSecret })
    .onConflictDoNothing();

  const secretRows = await db
    .select({ value: schema.config.value })
    .from(schema.config)
    .where(eq(schema.config.key, JWT_SECRET_KEY))
    .limit(1)
    .all();

  const secretRow = secretRows[0];

  if (!secretRow) {
    throw new Error("Failed to retrieve or store JWT secret.");
  }

  return secretRow.value;
}

export async function getUserRoles(
  username: string
): Promise<RoleAssignment[]> {
  const rows = await db
    .select({ role: schema.roles.role, event: schema.roles.event })
    .from(schema.roles)
    .where(eq(schema.roles.username, username))
    .all();

  const assignments: RoleAssignment[] = [];

  for (const row of rows) {
    const parsedRole = safeParse(roleAssignmentSchema, row);
    if (!parsedRole.success) {
      throw new Error(`Invalid role row for user '${username}'.`);
    }
    assignments.push(parsedRole.output);
  }

  return assignments;
}

export async function authenticateUser(
  credentials: LoginBody
): Promise<AuthenticatedUser | null> {
  const users = await db
    .select({
      username: schema.users.username,
      hashedPassword: schema.users.hashedPassword,
      type: schema.users.type,
      used: schema.users.used,
    })
    .from(schema.users)
    .where(eq(schema.users.username, credentials.username))
    .limit(1)
    .all();

  const user = users[0];

  if (!user?.used) {
    return null;
  }

  const passwordValid = await Bun.password.verify(
    credentials.password,
    user.hashedPassword
  );
  if (!passwordValid) {
    return null;
  }

  const roles = await getUserRoles(user.username);
  return {
    username: user.username,
    type: user.type,
    roles,
  };
}

export async function issueAccessToken(
  user: AuthenticatedUser
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: AuthToken = {
    sub: user.username,
    type: user.type,
    roles: user.roles,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };

  return sign(tokenPayload, await getJwtSecret(), "HS256");
}

export async function recordLogin(user: AuthenticatedUser): Promise<void> {
  await db.insert(schema.eventLog).values({
    timestamp: Date.now(),
    type: "AUTH_LOGIN",
    event: null,
    info: user.username,
    extra: JSON.stringify({ roles: user.roles }),
  });
}

export async function recordLogout(username: string): Promise<void> {
  await db.insert(schema.eventLog).values({
    timestamp: Date.now(),
    type: "AUTH_LOGOUT",
    event: null,
    info: username,
    extra: "[]",
  });
}
