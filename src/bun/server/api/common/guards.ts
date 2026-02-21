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

function hasInspectorRole(c: Context<AppEnv>, eventCode: string): boolean {
  const auth = c.get("auth");
  const inspectorRoles = new Set([
    "ADMIN",
    "INSPECTOR",
    "LEAD_INSPECTOR",
    "TSO",
    "HEAD_REFEREE",
  ]);
  return auth.roles.some(
    (role) =>
      inspectorRoles.has(role.role) &&
      (role.event === "*" || role.event === eventCode)
  );
}

export function requireInspector(
  c: Context<AppEnv>,
  eventCode: string
): Response | null {
  if (hasInspectorRole(c, eventCode)) {
    return null;
  }

  return c.json(
    { error: "Forbidden", message: "Inspector access required." },
    403
  );
}

function hasLeadInspectorRole(c: Context<AppEnv>, eventCode: string): boolean {
  const auth = c.get("auth");
  const leadRoles = new Set(["ADMIN", "LEAD_INSPECTOR"]);
  return auth.roles.some(
    (role) =>
      leadRoles.has(role.role) &&
      (role.event === "*" || role.event === eventCode)
  );
}

export function requireLeadInspector(
  c: Context<AppEnv>,
  eventCode: string
): Response | null {
  if (hasLeadInspectorRole(c, eventCode)) {
    return null;
  }

  return c.json(
    { error: "Forbidden", message: "Lead Inspector access required." },
    403
  );
}
