import type {
  PersistUpdatedUserAccountInput,
  PersistUserAccountInput,
  StoredUser,
  UserRoleAssignment,
} from "../dtos/users";

export interface UserRepository {
  createUserAccount(input: PersistUserAccountInput): Promise<void>;

  deleteUserAccount(username: string): Promise<void>;

  findMissingEventCodes(eventCodes: string[]): Promise<string[]>;

  getUser(username: string): Promise<StoredUser | null>;

  getUserRoles(username: string): Promise<UserRoleAssignment[]>;

  isLastGlobalAdmin(username: string): Promise<boolean>;

  listUsers(): Promise<StoredUser[]>;

  updateUserAccount(input: PersistUpdatedUserAccountInput): Promise<void>;
}
