import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "../../../db";
import { getUserRoles } from "../auth/auth.service";
import type { CreateUserRole } from "./users.schema";

export class UserServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface NormalizedUserRole {
  event: string;
  role: CreateUserRole["role"];
}

function normalizeUserRoles(roles: CreateUserRole[]): NormalizedUserRole[] {
  return roles.map((assignment) => ({
    event:
      assignment.event === "*"
        ? assignment.event
        : assignment.event.toLowerCase(),
    role: assignment.role,
  }));
}

function findDuplicateRoleAssignments(
  roles: NormalizedUserRole[]
): string | null {
  const roleKeys = new Set<string>();

  for (const assignment of roles) {
    const key = `${assignment.event}:${assignment.role}`;
    if (roleKeys.has(key)) {
      return `Duplicate role assignment: ${assignment.role} for event ${assignment.event}.`;
    }

    roleKeys.add(key);
  }

  return null;
}

async function findMissingEvents(
  roles: NormalizedUserRole[]
): Promise<string[]> {
  const scopedEvents = Array.from(
    new Set(
      roles
        .filter((assignment) => assignment.event !== "*")
        .map((assignment) => assignment.event)
    )
  );

  if (scopedEvents.length === 0) {
    return [];
  }

  const existingEvents = await db
    .select({ code: schema.events.code })
    .from(schema.events)
    .where(inArray(schema.events.code, scopedEvents))
    .all();

  const existingCodes = new Set(existingEvents.map((event) => event.code));
  return scopedEvents.filter((code) => !existingCodes.has(code));
}

async function validateRoleAssignments(
  roles: CreateUserRole[]
): Promise<NormalizedUserRole[]> {
  if (roles.length === 0) {
    throw new UserServiceError(
      "At least one role assignment is required.",
      400
    );
  }

  const normalizedRoles = normalizeUserRoles(roles);
  const duplicateRoleMessage = findDuplicateRoleAssignments(normalizedRoles);
  if (duplicateRoleMessage) {
    throw new UserServiceError(duplicateRoleMessage, 400);
  }

  const missingEvents = await findMissingEvents(normalizedRoles);
  if (missingEvents.length > 0) {
    throw new UserServiceError(
      `Event does not exist: ${missingEvents.join(", ")}.`,
      400
    );
  }

  return normalizedRoles;
}

export function listUsers() {
  return db
    .select({
      generic: schema.users.generic,
      type: schema.users.type,
      used: schema.users.used,
      username: schema.users.username,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.username))
    .all();
}

export async function getUserWithRoles(username: string) {
  const [user] = await db
    .select({
      generic: schema.users.generic,
      type: schema.users.type,
      used: schema.users.used,
      username: schema.users.username,
    })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .limit(1)
    .all();

  if (!user) {
    return null;
  }

  const roles = await getUserRoles(username);
  return {
    ...user,
    roles,
  };
}

export async function createUserAccount(input: {
  password: string;
  roles: CreateUserRole[];
  username: string;
}) {
  const normalizedRoles = await validateRoleAssignments(input.roles);

  const hashedPassword = await Bun.password.hash(input.password, {
    algorithm: "bcrypt",
    cost: 10,
  });
  const now = Date.now();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        username: input.username,
        hashedPassword,
        type: 0,
        used: true,
        generic: false,
      });

      await tx.insert(schema.roles).values(
        normalizedRoles.map((assignment) => ({
          username: input.username,
          role: assignment.role,
          event: assignment.event,
        }))
      );

      await tx.insert(schema.eventLog).values({
        timestamp: now,
        type: "USER_CREATED",
        event: null,
        info: input.username,
        extra: JSON.stringify({ roles: normalizedRoles }),
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("UNIQUE constraint failed: users.username")
    ) {
      throw new UserServiceError(
        `User "${input.username}" already exists.`,
        409
      );
    }

    throw error;
  }

  return {
    username: input.username,
    type: 0,
    roles: normalizedRoles,
  };
}

export async function updateUserAccount(input: {
  password: string;
  roles: CreateUserRole[];
  username: string;
}) {
  const normalizedRoles = await validateRoleAssignments(input.roles);

  const [existingUser] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.username, input.username))
    .limit(1)
    .all();

  if (!existingUser) {
    throw new UserServiceError(`User "${input.username}" was not found.`, 404);
  }

  const hasPassword = input.password.length > 0;
  const hashedPassword = hasPassword
    ? await Bun.password.hash(input.password, {
        algorithm: "bcrypt",
        cost: 10,
      })
    : null;

  await db.transaction(async (tx) => {
    if (hashedPassword) {
      await tx
        .update(schema.users)
        .set({ hashedPassword })
        .where(eq(schema.users.username, input.username));
    }

    await tx
      .delete(schema.roles)
      .where(eq(schema.roles.username, input.username));

    await tx.insert(schema.roles).values(
      normalizedRoles.map((assignment) => ({
        username: input.username,
        role: assignment.role,
        event: assignment.event,
      }))
    );

    await tx.insert(schema.eventLog).values({
      timestamp: Date.now(),
      type: "USER_UPDATED",
      event: null,
      info: input.username,
      extra: JSON.stringify({
        passwordUpdated: Boolean(hashedPassword),
        roles: normalizedRoles,
      }),
    });
  });

  return {
    username: input.username,
    type: 0,
    roles: normalizedRoles,
  };
}

export async function deleteUserAccount(input: {
  currentUsername: string;
  username: string;
}): Promise<void> {
  if (input.username === input.currentUsername) {
    throw new UserServiceError(
      "You cannot delete the currently logged in user.",
      400
    );
  }

  const [existingUser] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.username, input.username))
    .limit(1)
    .all();

  if (!existingUser) {
    throw new UserServiceError(`User "${input.username}" was not found.`, 404);
  }

  await db.transaction(async (tx) => {
    const [{ globalAdminCount }] = await tx
      .select({ globalAdminCount: count() })
      .from(schema.roles)
      .where(and(eq(schema.roles.role, "ADMIN"), eq(schema.roles.event, "*")))
      .all();

    const [targetAdminRole] = await tx
      .select({ username: schema.roles.username })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.username, input.username),
          eq(schema.roles.role, "ADMIN"),
          eq(schema.roles.event, "*")
        )
      )
      .limit(1)
      .all();

    if (targetAdminRole && globalAdminCount <= 1) {
      throw new UserServiceError(
        "Cannot delete the last global admin user.",
        400
      );
    }

    await tx
      .delete(schema.users)
      .where(eq(schema.users.username, input.username));

    await tx.insert(schema.eventLog).values({
      timestamp: Date.now(),
      type: "USER_DELETED",
      event: null,
      info: input.username,
      extra: "[]",
    });
  });
}
