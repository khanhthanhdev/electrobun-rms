import { Hono } from "hono";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import {
  getDisplayTextSettings,
  saveDisplayTextSettings,
  validateDisplayTextSettings,
} from "./display-settings-store";
import { publishDisplaySettingsUpdate } from "./display-sync";

export const displaySettingsRoutes = new Hono<AppEnv>();

displaySettingsRoutes.get("/:eventCode/display/settings", (c) => {
  const eventCode = c.req.param("eventCode");
  return c.json({ settings: getDisplayTextSettings(eventCode) });
});

displaySettingsRoutes.put(
  "/:eventCode/display/settings",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const result = validateDisplayTextSettings(body);
    if ("error" in result) {
      return c.json({ error: "Validation failed", message: result.error }, 400);
    }

    try {
      const settings = saveDisplayTextSettings(eventCode, result.settings);
      publishDisplaySettingsUpdate(eventCode);
      return c.json({ settings });
    } catch (error) {
      return c.json(
        {
          error: "Display settings save failed",
          message:
            error instanceof Error ? error.message : "Unable to save settings.",
        },
        404
      );
    }
  }
);
