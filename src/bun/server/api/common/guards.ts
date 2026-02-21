import type { Context } from "hono";
import type { AppEnv } from "./app-env";

function hasGlobalAdminRole(c: Context<AppEnv>): boolean {
  const auth = c.get("auth");
  return auth.roles.some((role) => role.role === "ADMIN" && role.event === "*");
}

function hasEventAdminRole(c: Context<AppEnv>, eventCode: string): boolean {
  const auth = c.get("auth");
  return auth.roles.some(
    (role) =>
      role.role === "ADMIN" && (role.event === "*" || role.event === eventCode)
  );
}

export function requireGlobalAdmin(c: Context<AppEnv>): Response | null {
  if (hasGlobalAdminRole(c)) {
    return null;
  }

  return c.json({ error: "Forbidden", message: "Admin access required." }, 403);
}

export function requireEventAdmin(
  c: Context<AppEnv>,
  eventCode: string
): Response | null {
  if (hasEventAdminRole(c, eventCode)) {
    return null;
  }

  return c.json(
    {
      error: "Forbidden",
      message: `Admin access for event "${eventCode}" is required.`,
    },
    403
  );
}
