import { Hono } from "hono";
import { safeParse } from "valibot";
import { ServiceError } from "../../services/manual-event-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { manualEventBodySchema } from "./events.schema";
import {
  createEventFromManualPayload,
  listDefaultEventAccounts,
  listEvents,
} from "./events.service";

export const eventsRoutes = new Hono<AppEnv>();

eventsRoutes.get("/", async (c) => {
  const events = await listEvents();
  return c.json({ events });
});

eventsRoutes.post("/manual", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(manualEventBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  try {
    const result = await createEventFromManualPayload(bodyResult.output);
    return c.json(result, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Event creation failed", message: error.message },
        error.status as 400 | 409 | 500
      );
    }
    throw error;
  }
});

eventsRoutes.get("/:eventCode/default-accounts", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const eventCode = c.req.param("eventCode");
  try {
    const accounts = await listDefaultEventAccounts(eventCode);
    return c.json(accounts);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to retrieve accounts", message: error.message },
        error.status as 400 | 404
      );
    }
    throw error;
  }
});
