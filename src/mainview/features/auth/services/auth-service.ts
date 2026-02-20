import { requestEmpty, requestJson } from "../../../shared/api/http-client";
import type { AuthUser, LoginCredentials } from "../../../shared/types/auth";

interface CurrentUserResponse {
  user: AuthUser;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

export const fetchCurrentUser = async (token: string): Promise<AuthUser> => {
  const data = await requestJson<CurrentUserResponse>("/auth/me", { token });
  return data.user;
};

export const loginUser = async (
  credentials: LoginCredentials
): Promise<LoginResponse> =>
  requestJson<LoginResponse>("/auth/login", {
    body: JSON.stringify(credentials),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

export const logoutUser = async (token: string): Promise<void> =>
  requestEmpty("/auth/logout", {
    method: "POST",
    token,
  });
