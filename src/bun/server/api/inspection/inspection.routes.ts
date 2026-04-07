import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { ApplicationError } from "../../application/common/application-error";
import {
  ApplyOverrideUseCase,
  GetChecklistUseCase,
  GetInspectionHistoryUseCase,
  GetPublicStatusUseCase,
  GetTeamDetailUseCase,
  GetTeamListUseCase,
  SaveInspectionCommentUseCase,
  UpdateInspectionItemsUseCase,
  UpdateInspectionStatusUseCase,
} from "../../application/use-cases/inspection";
import { SQLiteInspectionRepository } from "../../infrastructure/adapters/inspection";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireInspector, requireLeadInspector } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { awaitStreamClose } from "../common/sse";
import { formatValidationIssues } from "../common/validation";
import {
  overrideStatusBodySchema,
  saveCommentBodySchema,
  updateItemsBodySchema,
  updateStatusBodySchema,
} from "./inspection.schema";
import {
  createInspectionSnapshotHintEvent,
  INSPECTION_SYNC_EVENT_NAME,
  type InspectionSyncEvent,
  inspectionSyncHub,
} from "./inspection-sync";

export const inspectionRoutes = new Hono<AppEnv>();

const inspectionRepository = new SQLiteInspectionRepository();
const getChecklistUseCase = new GetChecklistUseCase(inspectionRepository);
const getTeamListUseCase = new GetTeamListUseCase(inspectionRepository);
const getTeamDetailUseCase = new GetTeamDetailUseCase(inspectionRepository);
const updateInspectionItemsUseCase = new UpdateInspectionItemsUseCase(
  inspectionRepository
);
const updateInspectionStatusUseCase = new UpdateInspectionStatusUseCase(
  inspectionRepository
);
const saveInspectionCommentUseCase = new SaveInspectionCommentUseCase(
  inspectionRepository
);
const getInspectionHistoryUseCase = new GetInspectionHistoryUseCase(
  inspectionRepository
);
const applyOverrideUseCase = new ApplyOverrideUseCase(inspectionRepository);
const getPublicStatusUseCase = new GetPublicStatusUseCase(inspectionRepository);

const isApplicationError = (error: unknown): error is ApplicationError =>
  error instanceof ApplicationError;

const parseTeamNumberParam = (
  value: string
): { teamNumber: number } | { error: string } => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { error: "Team number must be a positive whole number." };
  }
  return { teamNumber: parsed };
};

const SSE_RETRY_MS = 2000;
const SSE_HEARTBEAT_MS = 20_000;

const writeInspectionSyncEvent = async (
  stream: SSEStreamingApi,
  event: InspectionSyncEvent
): Promise<void> => {
  await stream.writeSSE({
    data: JSON.stringify(event),
    event: INSPECTION_SYNC_EVENT_NAME,
    id: `${event.eventCode}:${event.version}`,
    retry: SSE_RETRY_MS,
  });
};

inspectionRoutes.get("/:eventCode/inspection/checklist", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireInspector(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  return c.json(getChecklistUseCase.execute());
});

inspectionRoutes.get("/:eventCode/inspection/stream", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireInspector(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

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

    const snapshotEvent = createInspectionSnapshotHintEvent(
      eventCode,
      inspectionSyncHub.getCurrentVersion(eventCode)
    );
    enqueueWrite((streamApi) =>
      writeInspectionSyncEvent(streamApi, snapshotEvent)
    );

    const unsubscribe = inspectionSyncHub.subscribe(eventCode, (event) => {
      enqueueWrite((streamApi) => writeInspectionSyncEvent(streamApi, event));
    });

    const heartbeatIntervalId = setInterval(() => {
      enqueueWrite(async (streamApi) => {
        await streamApi.write(": heartbeat\n\n");
      });
    }, SSE_HEARTBEAT_MS);

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

inspectionRoutes.get("/:eventCode/inspection/teams", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireInspector(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const search = c.req.query("search");

  try {
    const result = getTeamListUseCase.execute({ eventCode, search });
    return c.json(result);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        { error: "Failed to load inspection teams", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

inspectionRoutes.get(
  "/:eventCode/inspection/teams/:teamNumber",
  requireAuth,
  (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireInspector(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
    if ("error" in teamNumberResult) {
      return c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      );
    }

    try {
      const detail = getTeamDetailUseCase.execute({
        eventCode,
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to load inspection detail",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

inspectionRoutes.patch(
  "/:eventCode/inspection/teams/:teamNumber/items",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireInspector(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
    if ("error" in teamNumberResult) {
      return c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      );
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(updateItemsBodySchema, body);
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
      const detail = updateInspectionItemsUseCase.execute({
        eventCode,
        teamNumber: teamNumberResult.teamNumber,
        items: bodyResult.output.items,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "ITEMS_UPDATED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to update inspection items",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

inspectionRoutes.patch(
  "/:eventCode/inspection/teams/:teamNumber/status",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireInspector(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
    if ("error" in teamNumberResult) {
      return c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      );
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(updateStatusBodySchema, body);
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
      const auth = c.get("auth");
      const detail = updateInspectionStatusUseCase.execute({
        eventCode,
        teamNumber: teamNumberResult.teamNumber,
        status: bodyResult.output.status,
        changedBy: auth.sub,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "STATUS_UPDATED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to update inspection status",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

inspectionRoutes.post(
  "/:eventCode/inspection/teams/:teamNumber/comment",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireInspector(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
    if ("error" in teamNumberResult) {
      return c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      );
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(saveCommentBodySchema, body);
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
      saveInspectionCommentUseCase.execute({
        eventCode,
        teamNumber: teamNumberResult.teamNumber,
        comment: bodyResult.output.comment,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "COMMENT_UPDATED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json({ success: true });
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to save inspection comment",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

inspectionRoutes.get(
  "/:eventCode/inspection/teams/:teamNumber/history",
  requireAuth,
  (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireInspector(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
    if ("error" in teamNumberResult) {
      return c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      );
    }

    try {
      const result = getInspectionHistoryUseCase.execute({
        eventCode,
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(result);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to load inspection history",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

inspectionRoutes.post(
  "/:eventCode/inspection/teams/:teamNumber/override",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireLeadInspector(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
    if ("error" in teamNumberResult) {
      return c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      );
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(overrideStatusBodySchema, body);
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
      const auth = c.get("auth");
      const detail = applyOverrideUseCase.execute({
        eventCode,
        teamNumber: teamNumberResult.teamNumber,
        comment: bodyResult.output.comment,
        changedBy: auth.sub,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "OVERRIDE_APPLIED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to override inspection status",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

inspectionRoutes.get("/:eventCode/inspection/public-status", (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const result = getPublicStatusUseCase.execute({ eventCode });
    return c.json(result);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        {
          error: "Failed to load public inspection status",
          message: error.message,
        },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});
