export type UserRoleName =
  | "ADMIN"
  | "TSO"
  | "HEAD_REFEREE"
  | "REFEREE"
  | "INSPECTOR"
  | "LEAD_INSPECTOR"
  | "JUDGE";

export interface UserRoleAssignment {
  event: string;
  role: UserRoleName;
}

export interface StoredUser {
  generic: boolean;
  type: number;
  used: boolean;
  username: string;
}

export interface UserWithRoles extends StoredUser {
  roles: UserRoleAssignment[];
}

export interface ManagedUserAccount {
  roles: UserRoleAssignment[];
  type: number;
  username: string;
}

export interface CreateUserAccountInput {
  password: string;
  roles: UserRoleAssignment[];
  username: string;
}

export interface PersistUserAccountInput {
  hashedPassword: string;
  roles: UserRoleAssignment[];
  username: string;
}

export interface UpdateUserAccountInput {
  password: string;
  roles: UserRoleAssignment[];
  username: string;
}

export interface PersistUpdatedUserAccountInput {
  hashedPassword: string | null;
  roles: UserRoleAssignment[];
  username: string;
}

export interface DeleteUserAccountInput {
  currentUsername: string;
  username: string;
}
