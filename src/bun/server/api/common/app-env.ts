import type { AuthToken } from "../auth/auth.schema";

export interface AppEnv {
  Variables: {
    auth: AuthToken;
  };
}
