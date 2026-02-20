import { requestEmpty, requestJson } from "../../../shared/api/http-client";
import type { RoleValue } from "../../../shared/constants/roles";

export interface CreateUserRoleAssignment {
  event: string;
  role: RoleValue;
}

export interface CreateUserPayload {
  password: string;
  passwordConfirm: string;
  roles: CreateUserRoleAssignment[];
  username: string;
}

export interface CreateUserResponse {
  user: {
    roles: CreateUserRoleAssignment[];
    type: number;
    username: string;
  };
}

export interface ManagedUserItem {
  generic: boolean;
  type: number;
  used: boolean;
  username: string;
}

export interface ListUsersResponse {
  users: ManagedUserItem[];
}

export interface GetUserResponse {
  user: ManagedUserItem & {
    roles: CreateUserRoleAssignment[];
  };
}

export interface UpdateUserPayload {
  password: string;
  passwordConfirm: string;
  roles: CreateUserRoleAssignment[];
}

export interface UpdateUserResponse {
  user: {
    roles: CreateUserRoleAssignment[];
    type: number;
    username: string;
  };
}

export const createUserAccount = async (
  payload: CreateUserPayload,
  token: string
): Promise<CreateUserResponse> =>
  requestJson<CreateUserResponse>("/users", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    token,
  });

export const listUsers = async (token: string): Promise<ListUsersResponse> =>
  requestJson<ListUsersResponse>("/users", { token });

export const getUser = async (
  username: string,
  token: string
): Promise<GetUserResponse> =>
  requestJson<GetUserResponse>(`/users/${encodeURIComponent(username)}`, {
    token,
  });

export const updateUser = async (
  username: string,
  payload: UpdateUserPayload,
  token: string
): Promise<UpdateUserResponse> =>
  requestJson<UpdateUserResponse>(`/users/${encodeURIComponent(username)}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
    token,
  });

export const deleteUser = async (
  username: string,
  token: string
): Promise<void> =>
  requestEmpty(`/users/${encodeURIComponent(username)}`, {
    method: "DELETE",
    token,
  });
