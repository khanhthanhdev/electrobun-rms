import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db, schema } from "../../../../db";
import { ApplicationError } from "../../../application/common/application-error";
import type {
  PersistUpdatedUserAccountInput,
  PersistUserAccountInput,
  StoredUser,
  UserRoleAssignment,
} from "../../../application/dtos/users";
import type { UserRepository } from "../../../application/interfaces/user-repository";

const isUniqueUsernameError = (error: unknown): error is Error =>
  error instanceof Error &&
  error.message.includes("UNIQUE constraint failed: users.username");

export class SQLiteUserRepository implements UserRepository {
  listUsers(): Promise<StoredUser[]> {
    return Promise.resolve(
      db
        .select({
          generic: schema.users.generic,
          type: schema.users.type,
          used: schema.users.used,
          username: schema.users.username,
        })
        .from(schema.users)
        .orderBy(asc(schema.users.username))
        .all()
    );
  }

  async getUser(username: string): Promise<StoredUser | null> {
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

    return user ?? null;
  }

  async getUserRoles(username: string): Promise<UserRoleAssignment[]> {
    const rows = await db
      .select({ event: schema.roles.event, role: schema.roles.role })
      .from(schema.roles)
      .where(eq(schema.roles.username, username))
      .orderBy(asc(schema.roles.role), asc(schema.roles.event))
      .all();

    return rows.map((row) => ({
      event: row.event,
      role: row.role as UserRoleAssignment["role"],
    }));
  }

  async findMissingEventCodes(eventCodes: string[]): Promise<string[]> {
    if (eventCodes.length === 0) {
      return [];
    }

    const existingEvents = await db
      .select({ code: schema.events.code })
      .from(schema.events)
      .where(inArray(schema.events.code, eventCodes))
      .all();

    const existingCodes = new Set(existingEvents.map((event) => event.code));
    return eventCodes.filter((code) => !existingCodes.has(code));
  }

  async createUserAccount(input: PersistUserAccountInput): Promise<void> {
    try {
      await db.transaction(async (tx) => {
        await tx.insert(schema.users).values({
          username: input.username,
          hashedPassword: input.hashedPassword,
          type: 0,
          used: true,
          generic: false,
        });

        await tx.insert(schema.roles).values(
          input.roles.map((assignment) => ({
            username: input.username,
            role: assignment.role,
            event: assignment.event,
          }))
        );

        await tx.insert(schema.eventLog).values({
          timestamp: Date.now(),
          type: "USER_CREATED",
          event: null,
          info: input.username,
          extra: JSON.stringify({ roles: input.roles }),
        });
      });
    } catch (error) {
      if (isUniqueUsernameError(error)) {
        throw new ApplicationError(
          `User "${input.username}" already exists.`,
          409
        );
      }

      throw error;
    }
  }

  async updateUserAccount(
    input: PersistUpdatedUserAccountInput
  ): Promise<void> {
    await db.transaction(async (tx) => {
      if (input.hashedPassword) {
        await tx
          .update(schema.users)
          .set({ hashedPassword: input.hashedPassword })
          .where(eq(schema.users.username, input.username));
      }

      await tx
        .delete(schema.roles)
        .where(eq(schema.roles.username, input.username));

      await tx.insert(schema.roles).values(
        input.roles.map((assignment) => ({
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
          passwordUpdated: Boolean(input.hashedPassword),
          roles: input.roles,
        }),
      });
    });
  }

  async isLastGlobalAdmin(username: string): Promise<boolean> {
    const [{ globalAdminCount }] = await db
      .select({ globalAdminCount: count() })
      .from(schema.roles)
      .where(and(eq(schema.roles.role, "ADMIN"), eq(schema.roles.event, "*")))
      .all();

    const [targetAdminRole] = await db
      .select({ username: schema.roles.username })
      .from(schema.roles)
      .where(
        and(
          eq(schema.roles.username, username),
          eq(schema.roles.role, "ADMIN"),
          eq(schema.roles.event, "*")
        )
      )
      .limit(1)
      .all();

    return Boolean(targetAdminRole) && globalAdminCount <= 1;
  }

  async deleteUserAccount(username: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(schema.users).where(eq(schema.users.username, username));

      await tx.insert(schema.eventLog).values({
        timestamp: Date.now(),
        type: "USER_DELETED",
        event: null,
        info: username,
        extra: "[]",
      });
    });
  }
}
