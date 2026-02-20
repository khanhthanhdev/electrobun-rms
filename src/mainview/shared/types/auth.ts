export interface UserRole {
  event: string;
  role: string;
}

export interface AuthUser {
  roles: UserRole[];
  type: number;
  username: string;
}

export interface LoginCredentials {
  password: string;
  username: string;
}

export type AuthRoutePath = "/" | "/login";
