import type { Context } from "hono";
import type { AppEnv } from "./app-env";

function hasGlobalAdminRole(c: Context<AppEnv>): boolean {
  const auth = c.get("auth");
  return auth.roles.some((role) => role.role === "ADMIN" && role.event === "*");
}

export function requireGlobalAdmin(c: Context<AppEnv>): Response | null {
  if (hasGlobalAdminRole(c)) {
    return null;
  }

  return c.json({ error: "Forbidden", message: "Admin access required." }, 403);
}
