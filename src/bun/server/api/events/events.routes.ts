import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { ServiceError } from "../../services/manual-event-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin, requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { manualEventBodySchema, updateEventBodySchema } from "./events.schema";
import {
  createEventFromManualPayload,
  getEvent,
  listDefaultEventAccounts,
  listEventPrintLists,
  listEventQualificationRankings,
  listEvents,
  rebuildEventQualificationRankings,
  regenerateDefaultEventAccounts,
  updateEvent,
} from "./events.service";
import {
  createQualificationRankingsSnapshotHintEvent,
  QUALIFICATION_RANKINGS_SYNC_EVENT_NAME,
  type QualificationRankingsSyncEvent,
  qualificationRankingsSyncHub,
} from "./rankings-sync";

export const eventsRoutes = new Hono<AppEnv>();

const RANKINGS_SSE_RETRY_MS = 2000;
const RANKINGS_SSE_HEARTBEAT_MS = 20_000;

const writeQualificationRankingsSyncEvent = async (
  stream: SSEStreamingApi,
  event: QualificationRankingsSyncEvent
): Promise<void> => {
  await stream.writeSSE({
    data: JSON.stringify(event),
    event: QUALIFICATION_RANKINGS_SYNC_EVENT_NAME,
    id: `${event.eventCode}:${event.version}`,
    retry: RANKINGS_SSE_RETRY_MS,
  });
};

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

eventsRoutes.get("/:eventCode", (c) => {
  const eventCode = c.req.param("eventCode");
  const event = getEvent(eventCode);
  if (!event) {
    return c.json({ error: "Event not found" }, 404);
  }
  return c.json({ event });
});

eventsRoutes.put("/:eventCode", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const eventCode = c.req.param("eventCode");
  const existing = await getEvent(eventCode);
  if (!existing) {
    return c.json({ error: "Event not found" }, 404);
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(updateEventBodySchema, body);
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
    const updatedEvent = await updateEvent(eventCode, bodyResult.output);
    return c.json({ event: updatedEvent });
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Event update failed", message: error.message },
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

eventsRoutes.post(
  "/:eventCode/default-accounts/regenerate",
  requireAuth,
  async (c) => {
    const forbiddenResponse = requireGlobalAdmin(c);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const eventCode = c.req.param("eventCode");
    try {
      const accounts = await regenerateDefaultEventAccounts(eventCode);
      return c.json(accounts);
    } catch (error) {
      if (error instanceof ServiceError) {
        return c.json(
          {
            error: "Failed to regenerate default accounts",
            message: error.message,
          },
          error.status as 400 | 404 | 409
        );
      }
      throw error;
    }
  }
);

eventsRoutes.get("/:eventCode/print-lists", requireAuth, (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const eventCode = c.req.param("eventCode");

  try {
    const reportLists = listEventPrintLists(eventCode);
    return c.json(reportLists);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to load printable lists", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

eventsRoutes.get("/:eventCode/qualification-rankings/stream", (c) => {
  const eventCode = c.req.param("eventCode");

  return streamSSE(c, async (stream) => {
    let queuedWrite = Promise.resolve();

    const enqueueWrite = (
      writeOperation: (streamApi: SSEStreamingApi) => Promise<void>
    ): void => {
      queuedWrite = queuedWrite
        .then(async () => {
          if (stream.aborted || stream.closed) {
            return;
          }
          await writeOperation(stream);
        })
        .catch(() => {
          // Ignore write failures after disconnect.
        });
    };

    const snapshotEvent = createQualificationRankingsSnapshotHintEvent(
      eventCode,
      qualificationRankingsSyncHub.getCurrentVersion(eventCode)
    );
    enqueueWrite((streamApi) =>
      writeQualificationRankingsSyncEvent(streamApi, snapshotEvent)
    );

    const unsubscribe = qualificationRankingsSyncHub.subscribe(
      eventCode,
      (event) => {
        enqueueWrite((streamApi) =>
          writeQualificationRankingsSyncEvent(streamApi, event)
        );
      }
    );

    const heartbeatIntervalId = setInterval(() => {
      enqueueWrite(async (streamApi) => {
        await streamApi.write(": heartbeat\n\n");
      });
    }, RANKINGS_SSE_HEARTBEAT_MS);

    let isCleanedUp = false;
    const cleanup = (): void => {
      if (isCleanedUp) {
        return;
      }
      isCleanedUp = true;
      clearInterval(heartbeatIntervalId);
      unsubscribe();
    };

    stream.onAbort(() => {
      cleanup();
    });

    try {
      while (!stream.aborted) {
        await stream.sleep(1000);
      }
    } finally {
      cleanup();
      await queuedWrite;
    }
  });
});

eventsRoutes.post(
  "/:eventCode/qualification-rankings/rebuild",
  requireAuth,
  (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    try {
      const rankings = rebuildEventQualificationRankings(eventCode);
      qualificationRankingsSyncHub.publish({
        eventCode,
        kind: "RANKINGS_UPDATED",
      });
      return c.json(rankings);
    } catch (error) {
      if (error instanceof ServiceError) {
        return c.json(
          {
            error: "Failed to rebuild qualification rankings",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

eventsRoutes.get("/:eventCode/qualification-rankings", (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const rankings = listEventQualificationRankings(eventCode);
    return c.json(rankings);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        {
          error: "Failed to load qualification rankings",
          message: error.message,
        },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});
