import { ApplicationError } from "../../common/application-error";
import type { ManagedUserAccount, UserRoleAssignment } from "../../dtos/users";
import type { UserRepository } from "../../interfaces/user-repository";

const toUniqueScopedEvents = (roles: UserRoleAssignment[]): string[] =>
  Array.from(
    new Set(
      roles
        .filter((assignment) => assignment.event !== "*")
        .map((assignment) => assignment.event)
    )
  );

const findDuplicateRoleMessage = (
  roles: UserRoleAssignment[]
): string | null => {
  const roleKeys = new Set<string>();

  for (const assignment of roles) {
    const key = `${assignment.event}:${assignment.role}`;
    if (roleKeys.has(key)) {
      return `Duplicate role assignment: ${assignment.role} for event ${assignment.event}.`;
    }

    roleKeys.add(key);
  }

  return null;
};

export const buildManagedUserAccount = (
  username: string,
  roles: UserRoleAssignment[]
): ManagedUserAccount => ({
  username,
  type: 0,
  roles,
});

export const hashUserPassword = async (password: string): Promise<string> =>
  Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });

export const validateUserRoleAssignments = async (
  userRepository: UserRepository,
  roles: UserRoleAssignment[]
): Promise<UserRoleAssignment[]> => {
  if (roles.length === 0) {
    throw new ApplicationError(
      "At least one role assignment is required.",
      400
    );
  }

  const normalizedRoles = roles.map((assignment) => ({
    event: assignment.event,
    role: assignment.role,
  }));
  const duplicateRoleMessage = findDuplicateRoleMessage(normalizedRoles);
  if (duplicateRoleMessage) {
    throw new ApplicationError(duplicateRoleMessage, 400);
  }

  const missingEvents = await userRepository.findMissingEventCodes(
    toUniqueScopedEvents(normalizedRoles)
  );
  if (missingEvents.length > 0) {
    throw new ApplicationError(
      `Event does not exist: ${missingEvents.join(", ")}.`,
      400
    );
  }

  return normalizedRoles;
};
