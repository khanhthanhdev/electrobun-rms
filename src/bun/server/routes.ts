import { eq } from "drizzle-orm";
import type { Context, Next } from "hono";
import { Hono } from "hono";
import { sign, verify } from "hono/jwt";
import {
  array,
  type BaseIssue,
  type InferOutput,
  maxLength,
  minLength,
  number,
  object,
  picklist,
  pipe,
  regex,
  safeParse,
  string,
} from "valibot";
import { db, schema } from "../db";

const api = new Hono<{
  Variables: {
    auth: AuthToken;
  };
}>();

const JWT_SECRET_KEY = "jwt_secret";
const TOKEN_TTL_SECONDS = 12 * 60 * 60;

const loginBodySchema = object({
  username: pipe(string(), minLength(1), maxLength(64)),
  password: pipe(string(), minLength(1), maxLength(128)),
});

const BEARER_REGEX = /^Bearer\s+\S+$/i;
const BEARER_PREFIX_REGEX = /^Bearer\s+/i;

const authHeaderSchema = object({
  authorization: pipe(
    string(),
    regex(BEARER_REGEX, "Authorization must be Bearer token")
  ),
});

const roleAssignmentSchema = object({
  role: picklist(schema.ROLE_VALUES),
  event: pipe(string(), minLength(1), maxLength(64)),
});

const authTokenSchema = object({
  sub: pipe(string(), minLength(1), maxLength(64)),
  type: number(),
  roles: array(roleAssignmentSchema),
  iat: number(),
  exp: number(),
});

type LoginBody = InferOutput<typeof loginBodySchema>;
type RoleAssignment = InferOutput<typeof roleAssignmentSchema>;
type AuthToken = InferOutput<typeof authTokenSchema>;

function formatValidationIssues(issues?: BaseIssue<unknown>[]): string {
  if (!issues || issues.length === 0) {
    return "Invalid request payload.";
  }

  return issues.map((issue) => issue.message).join("; ");
}

async function parseJsonBody(c: Context): Promise<unknown | null> {
  try {
    return await c.req.json();
  } catch {
    return null;
  }
}

function generateSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

async function getJwtSecret(): Promise<string> {
  const [secretRow] = await db
    .select({ value: schema.config.value })
    .from(schema.config)
    .where(eq(schema.config.key, JWT_SECRET_KEY))
    .limit(1)
    .all();

  if (secretRow) {
    return secretRow.value;
  }

  const createdSecret = generateSecret();
  await db.insert(schema.config).values({
    key: JWT_SECRET_KEY,
    value: createdSecret,
  });
  return createdSecret;
}

async function getUserRoles(username: string): Promise<RoleAssignment[]> {
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

async function requireAuth(
  c: Context,
  next: Next
): Promise<Response | undefined> {
  const authorization = c.req.header("authorization");
  const headerResult = safeParse(authHeaderSchema, { authorization });
  if (!headerResult.success) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = headerResult.output.authorization.replace(
    BEARER_PREFIX_REGEX,
    ""
  );
  const secret = await getJwtSecret();

  let payload: unknown;
  try {
    payload = await verify(token, secret, "HS256");
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const parsedPayload = safeParse(authTokenSchema, payload);
  if (!parsedPayload.success) {
    return c.json({ error: "Invalid token payload" }, 401);
  }

  c.set("auth", parsedPayload.output);
  await next();
}

api.get("/events", async (c) => {
  const rows = await db.select().from(schema.events).all();
  return c.json({ events: rows });
});

api.post("/auth/login", async (c) => {
  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(loginBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  const { username, password }: LoginBody = bodyResult.output;
  const [user] = await db
    .select({
      username: schema.users.username,
      hashedPassword: schema.users.hashedPassword,
      type: schema.users.type,
      used: schema.users.used,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
    .all();

  if (!user?.used) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const passwordValid = await Bun.password.verify(
    password,
    user.hashedPassword
  );
  if (!passwordValid) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const roles = await getUserRoles(user.username);
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload: AuthToken = {
    sub: user.username,
    type: user.type,
    roles,
    iat: now,
    exp: now + TOKEN_TTL_SECONDS,
  };
  const token = await sign(tokenPayload, await getJwtSecret(), "HS256");

  await db.insert(schema.eventLog).values({
    timestamp: Date.now(),
    type: "AUTH_LOGIN",
    event: null,
    info: user.username,
    extra: JSON.stringify({ roles }),
  });

  return c.json({
    token,
    user: {
      username: user.username,
      type: user.type,
      roles,
    },
  });
});

api.get("/auth/me", requireAuth, (c) => {
  const auth = c.get("auth");
  return c.json({
    user: {
      username: auth.sub,
      type: auth.type,
      roles: auth.roles,
    },
  });
});

api.post("/auth/logout", requireAuth, async (c) => {
  const auth = c.get("auth");
  await db.insert(schema.eventLog).values({
    timestamp: Date.now(),
    type: "AUTH_LOGOUT",
    event: null,
    info: auth.sub,
    extra: "[]",
  });

  return c.json({ ok: true });
});

export { api };
