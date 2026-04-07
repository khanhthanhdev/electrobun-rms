import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { ApplicationError } from "../../application/common/application-error";
import {
  CreateManualEventUseCase,
  GetEventUseCase,
  ListDefaultEventAccountsUseCase,
  ListEventPrintListsUseCase,
  ListEventsUseCase,
  RegenerateDefaultAccountsUseCase,
  UpdateEventUseCase,
} from "../../application/use-cases/events";
import {
  GetQualificationRankingsUseCase,
  RebuildQualificationRankingsUseCase,
} from "../../application/use-cases/ranking";
import { SQLiteEventRepository } from "../../infrastructure/adapters/events";
import { getEventPrintLists } from "../../infrastructure/adapters/events/sqlite-event-print-lists-service";
import {
  createManualEvent,
  getDefaultAccounts,
  regenerateEventDefaultAccounts,
} from "../../infrastructure/adapters/events/sqlite-manual-event-service";
import { SQLiteRankingRepository } from "../../infrastructure/adapters/ranking";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { awaitStreamClose } from "../common/sse";
import { requireEventAdmin, requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { manualEventBodySchema, updateEventBodySchema } from "./events.schema";
import {
  createQualificationRankingsSnapshotHintEvent,
  QUALIFICATION_RANKINGS_SYNC_EVENT_NAME,
  type QualificationRankingsSyncEvent,
  qualificationRankingsSyncHub,
} from "./rankings-sync";

export const eventsRoutes = new Hono<AppEnv>();

const RANKINGS_SSE_RETRY_MS = 2000;
const RANKINGS_SSE_HEARTBEAT_MS = 20_000;
const eventRepository = new SQLiteEventRepository();
const listEventsUseCase = new ListEventsUseCase(eventRepository);
const getEventUseCase = new GetEventUseCase(eventRepository);
const updateEventUseCase = new UpdateEventUseCase(eventRepository);
const createManualEventUseCase = new CreateManualEventUseCase({
  createManualEvent,
});
const listDefaultEventAccountsUseCase = new ListDefaultEventAccountsUseCase({
  getDefaultAccounts,
});
const regenerateDefaultAccountsUseCase = new RegenerateDefaultAccountsUseCase({
  regenerateDefaultAccounts: regenerateEventDefaultAccounts,
});
const listEventPrintListsUseCase = new ListEventPrintListsUseCase({
  getEventPrintLists,
});
const rankingRepository = new SQLiteRankingRepository();
const getQualificationRankingsUseCase = new GetQualificationRankingsUseCase(
  rankingRepository
);
const rebuildQualificationRankingsUseCase =
  new RebuildQualificationRankingsUseCase(rankingRepository);

const isApplicationError = (error: unknown): error is ApplicationError =>
  error instanceof ApplicationError;

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
  const response = await listEventsUseCase.execute();
  return c.json(response);
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
    const result = await createManualEventUseCase.execute({
      payload: bodyResult.output,
    });
    return c.json(result, 201);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        { error: "Event creation failed", message: error.message },
        error.status as 400 | 409 | 500
      );
    }
    throw error;
  }
});

eventsRoutes.get("/:eventCode", async (c) => {
  const eventCode = c.req.param("eventCode");
  try {
    const event = await getEventUseCase.execute({ eventCode });
    if (!event) {
      return c.json({ error: "Event not found" }, 404);
    }
    return c.json({ event });
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        { error: "Failed to load event", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

eventsRoutes.put("/:eventCode", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const eventCode = c.req.param("eventCode");
  try {
    const existing = await getEventUseCase.execute({ eventCode });
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

    const updatedEvent = await updateEventUseCase.execute({
      eventCode,
      payload: bodyResult.output,
    });
    return c.json({ event: updatedEvent });
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        { error: "Event update failed", message: error.message },
        error.status as 400 | 404 | 409 | 500
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
    const accounts = await listDefaultEventAccountsUseCase.execute({
      eventCode,
    });
    return c.json(accounts);
  } catch (error) {
    if (isApplicationError(error)) {
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
      const accounts = await regenerateDefaultAccountsUseCase.execute({
        eventCode,
      });
      return c.json(accounts);
    } catch (error) {
      if (isApplicationError(error)) {
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

eventsRoutes.get("/:eventCode/print-lists", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const eventCode = c.req.param("eventCode");

  try {
    const reportLists = await listEventPrintListsUseCase.execute({
      eventCode,
    });
    return c.json(reportLists);
  } catch (error) {
    if (isApplicationError(error)) {
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
      await awaitStreamClose(stream);
    } finally {
      cleanup();
      await queuedWrite;
    }
  });
});

eventsRoutes.post(
  "/:eventCode/qualification-rankings/rebuild",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    try {
      const rankings = await rebuildQualificationRankingsUseCase.execute({
        eventCode,
      });
      qualificationRankingsSyncHub.publish({
        eventCode,
        kind: "RANKINGS_UPDATED",
      });
      return c.json(rankings);
    } catch (error) {
      if (isApplicationError(error)) {
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

eventsRoutes.get("/:eventCode/qualification-rankings", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const rankings = await getQualificationRankingsUseCase.execute({
      eventCode,
    });
    return c.json(rankings);
  } catch (error) {
    if (isApplicationError(error)) {
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
