import { Hono } from "hono";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import {
  EVENT_CODE_VALIDATION_MESSAGE,
  isValidEventCode,
  normalizeEventCode,
} from "../common/patterns";
import {
  bootstrapEventFromRemoteUseCase,
  getSyncRemoteBaseUrlUseCase,
  setSyncRemoteBaseUrlUseCase,
  toSyncErrorResponse,
} from "./sync.shared";

export const syncConfigRoutes = new Hono<AppEnv>();

// Get NRC Web Base URL
syncConfigRoutes.get("/config/nrc-web-base-url", requireAuth, async (c) => {
  const forbidden = requireGlobalAdmin(c);
  if (forbidden) {
    return forbidden;
  }

  const baseUrl = await getSyncRemoteBaseUrlUseCase.execute();
  return c.json({
    baseUrl: baseUrl ?? undefined,
  });
});

// Update NRC Web Base URL
syncConfigRoutes.post("/config/nrc-web-base-url", requireAuth, async (c) => {
  const forbidden = requireGlobalAdmin(c);
  if (forbidden) {
    return forbidden;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const baseUrl = typeof payload.baseUrl === "string" ? payload.baseUrl : null;
  if (!baseUrl) {
    return c.json({ error: "baseUrl is required" }, 400);
  }

  try {
    const storedBaseUrl = await setSyncRemoteBaseUrlUseCase.execute({
      baseUrl,
    });
    return c.json({ baseUrl: storedBaseUrl, success: true });
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});

// Bootstrap Event from NRC Web
syncConfigRoutes.post("/bootstrap-event", requireAuth, async (c) => {
  const forbidden = requireGlobalAdmin(c);
  if (forbidden) {
    return forbidden;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const payload =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const eventKey =
    typeof payload.eventKey === "string" ? payload.eventKey : null;
  const eventCode =
    typeof payload.eventCode === "string"
      ? normalizeEventCode(payload.eventCode)
      : null;
  if (!eventKey) {
    return c.json({ error: "eventKey is required" }, 400);
  }
  if (!eventCode) {
    return c.json({ error: "eventCode is required" }, 400);
  }
  if (!isValidEventCode(eventCode)) {
    return c.json(
      {
        error: "VALIDATION_FAILED",
        message: EVENT_CODE_VALIDATION_MESSAGE,
      },
      400
    );
  }

  let baseUrl = (await getSyncRemoteBaseUrlUseCase.execute()) ?? undefined;
  if (typeof payload.baseUrl === "string" && payload.baseUrl.trim()) {
    try {
      baseUrl = await setSyncRemoteBaseUrlUseCase.execute({
        baseUrl: payload.baseUrl,
      });
    } catch (error) {
      const response = toSyncErrorResponse(error);
      return c.json(response.body, response.status);
    }
  }

  if (!baseUrl) {
    return c.json(
      {
        error:
          "NRC Web base URL is required. Provide it in the request or set it in server settings.",
      },
      400
    );
  }

  try {
    const createdEvent = await bootstrapEventFromRemoteUseCase.execute({
      baseUrl,
      eventCode,
      eventKey,
    });

    return c.json({
      success: true,
      eventCode: createdEvent.eventCode,
      redirectUrl: `/event/${createdEvent.eventCode}/dashboard/defaultaccounts`,
    });
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});
