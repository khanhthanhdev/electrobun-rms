import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { ServiceError } from "../../services/manual-event-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireInspector, requireLeadInspector } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import {
  overrideStatusBodySchema,
  saveCommentBodySchema,
  updateItemsBodySchema,
  updateStatusBodySchema,
} from "./inspection.schema";
import {
  getChecklist,
  getInspectionDetail,
  getInspectionHistory,
  getPublicInspectionStatus,
  listInspectionTeams,
  overrideInspectionStatus,
  saveInspectionComment,
  updateInspectionItems,
  updateInspectionStatus,
} from "./inspection.service";
import {
  createInspectionSnapshotHintEvent,
  INSPECTION_SYNC_EVENT_NAME,
  type InspectionSyncEvent,
  inspectionSyncHub,
} from "./inspection-sync";

export const inspectionRoutes = new Hono<AppEnv>();

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

  return c.json(getChecklist());
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
      while (!stream.aborted) {
        await stream.sleep(1000);
      }
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
    const result = listInspectionTeams(eventCode, search);
    return c.json(result);
  } catch (error) {
    if (error instanceof ServiceError) {
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
      const detail = getInspectionDetail(
        eventCode,
        teamNumberResult.teamNumber
      );
      return c.json(detail);
    } catch (error) {
      if (error instanceof ServiceError) {
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
      const detail = updateInspectionItems(
        eventCode,
        teamNumberResult.teamNumber,
        bodyResult.output.items
      );
      inspectionSyncHub.publish({
        eventCode,
        kind: "ITEMS_UPDATED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (error instanceof ServiceError) {
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
      const detail = updateInspectionStatus(
        eventCode,
        teamNumberResult.teamNumber,
        bodyResult.output.status,
        auth.sub
      );
      inspectionSyncHub.publish({
        eventCode,
        kind: "STATUS_UPDATED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (error instanceof ServiceError) {
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
      saveInspectionComment(
        eventCode,
        teamNumberResult.teamNumber,
        bodyResult.output.comment
      );
      inspectionSyncHub.publish({
        eventCode,
        kind: "COMMENT_UPDATED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json({ success: true });
    } catch (error) {
      if (error instanceof ServiceError) {
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
      const result = getInspectionHistory(
        eventCode,
        teamNumberResult.teamNumber
      );
      return c.json(result);
    } catch (error) {
      if (error instanceof ServiceError) {
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
      const detail = overrideInspectionStatus(
        eventCode,
        teamNumberResult.teamNumber,
        bodyResult.output.comment,
        auth.sub
      );
      inspectionSyncHub.publish({
        eventCode,
        kind: "OVERRIDE_APPLIED",
        teamNumber: teamNumberResult.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      if (error instanceof ServiceError) {
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
    const result = getPublicInspectionStatus(eventCode);
    return c.json(result);
  } catch (error) {
    if (error instanceof ServiceError) {
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
