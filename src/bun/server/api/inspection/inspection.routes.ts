import { Hono } from "hono";
import type { Context } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import type { BaseIssue, BaseSchema, InferOutput } from "valibot";
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
import { outboundSyncPushService } from "../../infrastructure/services/outbound-sync-push-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireInspector, requireLeadInspector } from "../common/guards";
import {
  getEventCodeWithGuard,
  parseJsonBodyOrResponse,
  safeParseOrResponse,
  toApplicationErrorResponse,
} from "../common/route-handler-helpers";
import { runQueuedHeartbeatSse } from "../common/sse";
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
const INVALID_JSON_BODY = { error: "Body must be valid JSON" } as const;

const getInspectorEventCode = (c: Context<AppEnv>) =>
  getEventCodeWithGuard(c, requireInspector);

const getLeadInspectorEventCode = (c: Context<AppEnv>) =>
  getEventCodeWithGuard(c, requireLeadInspector);

const parseInspectionBodyOrResponse = (c: Context) =>
  parseJsonBodyOrResponse(c, INVALID_JSON_BODY, 400);

const safeParseInspectionBodyOrResponse = <
  TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(
  c: Context,
  schema: TSchema,
  input: unknown
) =>
  safeParseOrResponse(c, schema, input, (issues) => ({
    error: "Validation failed",
    message: formatValidationIssues(issues),
  }));

const getTeamNumberOrResponse = (
  c: Context
): { ok: true; value: number } | { ok: false; response: Response } => {
  const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
  if ("error" in teamNumberResult) {
    return {
      ok: false,
      response: c.json(
        { error: "Validation failed", message: teamNumberResult.error },
        400
      ),
    };
  }
  return { ok: true, value: teamNumberResult.teamNumber };
};

type EventCodeResult =
  | { ok: true; value: string }
  | { ok: false; response: Response };

const getInspectionTeamContext = (
  c: Context<AppEnv>,
  eventCodeResolver: (ctx: Context<AppEnv>) => EventCodeResult
): { ok: true; value: { eventCode: string; teamNumber: number } } | {
  ok: false;
  response: Response;
} => {
  const eventCodeResult = eventCodeResolver(c);
  if (!eventCodeResult.ok) {
    return eventCodeResult;
  }

  const teamNumberResult = getTeamNumberOrResponse(c);
  if (!teamNumberResult.ok) {
    return teamNumberResult;
  }

  return {
    ok: true,
    value: {
      eventCode: eventCodeResult.value,
      teamNumber: teamNumberResult.value,
    },
  };
};

const getInspectionTeamPayload = async <
  TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(
  c: Context<AppEnv>,
  schema: TSchema,
  eventCodeResolver: (ctx: Context<AppEnv>) => EventCodeResult
): Promise<
  | {
      ok: true;
      value: {
        eventCode: string;
        teamNumber: number;
        payload: InferOutput<TSchema>;
      };
    }
  | { ok: false; response: Response }
> => {
  const teamContextResult = getInspectionTeamContext(c, eventCodeResolver);
  if (!teamContextResult.ok) {
    return teamContextResult;
  }

  const bodyResult = await parseInspectionBodyOrResponse(c);
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsedBodyResult = safeParseInspectionBodyOrResponse(
    c,
    schema,
    bodyResult.value
  );
  if (!parsedBodyResult.ok) {
    return parsedBodyResult;
  }

  return {
    ok: true,
    value: {
      eventCode: teamContextResult.value.eventCode,
      teamNumber: teamContextResult.value.teamNumber,
      payload: parsedBodyResult.value,
    },
  };
};

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
  const eventCodeResult = getInspectorEventCode(c);
  if (!eventCodeResult.ok) {
    return eventCodeResult.response;
  }

  return c.json(getChecklistUseCase.execute());
});

inspectionRoutes.get("/:eventCode/inspection/stream", requireAuth, (c) => {
  const eventCodeResult = getInspectorEventCode(c);
  if (!eventCodeResult.ok) {
    return eventCodeResult.response;
  }
  const eventCode = eventCodeResult.value;

  return streamSSE(c, async (stream) => {
    const snapshotEvent = createInspectionSnapshotHintEvent(
      eventCode,
      inspectionSyncHub.getCurrentVersion(eventCode)
    );
    await runQueuedHeartbeatSse<InspectionSyncEvent>(stream, {
      heartbeatMs: SSE_HEARTBEAT_MS,
      writeInitial: () => writeInspectionSyncEvent(stream, snapshotEvent),
      subscribe: (onEvent) => inspectionSyncHub.subscribe(eventCode, onEvent),
      writeEvent: (event) => writeInspectionSyncEvent(stream, event),
    });
  });
});

inspectionRoutes.get("/:eventCode/inspection/teams", requireAuth, (c) => {
  const eventCodeResult = getInspectorEventCode(c);
  if (!eventCodeResult.ok) {
    return eventCodeResult.response;
  }
  const eventCode = eventCodeResult.value;

  const search = c.req.query("search");

  try {
    const result = getTeamListUseCase.execute({ eventCode, search });
    return c.json(result);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to load inspection teams",
      message: applicationError.message,
    }));
  }
});

inspectionRoutes.get(
  "/:eventCode/inspection/teams/:teamNumber",
  requireAuth,
  (c) => {
    const teamContextResult = getInspectionTeamContext(c, getInspectorEventCode);
    if (!teamContextResult.ok) {
      return teamContextResult.response;
    }

    try {
      const detail = getTeamDetailUseCase.execute({
        eventCode: teamContextResult.value.eventCode,
        teamNumber: teamContextResult.value.teamNumber,
      });
      return c.json(detail);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to load inspection detail",
        message: applicationError.message,
      }));
    }
  }
);

inspectionRoutes.patch(
  "/:eventCode/inspection/teams/:teamNumber/items",
  requireAuth,
  async (c) => {
    const payloadResult = await getInspectionTeamPayload(
      c,
      updateItemsBodySchema,
      getInspectorEventCode
    );
    if (!payloadResult.ok) {
      return payloadResult.response;
    }
    const { eventCode, payload, teamNumber } = payloadResult.value;

    try {
      const detail = updateInspectionItemsUseCase.execute({
        eventCode,
        teamNumber,
        items: payload.items,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "ITEMS_UPDATED",
        teamNumber,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(detail);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to update inspection items",
        message: applicationError.message,
      }));
    }
  }
);

inspectionRoutes.patch(
  "/:eventCode/inspection/teams/:teamNumber/status",
  requireAuth,
  async (c) => {
    const payloadResult = await getInspectionTeamPayload(
      c,
      updateStatusBodySchema,
      getInspectorEventCode
    );
    if (!payloadResult.ok) {
      return payloadResult.response;
    }
    const { eventCode, payload, teamNumber } = payloadResult.value;

    try {
      const auth = c.get("auth");
      const detail = updateInspectionStatusUseCase.execute({
        eventCode,
        teamNumber,
        status: payload.status,
        changedBy: auth.sub,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "STATUS_UPDATED",
        teamNumber,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(detail);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to update inspection status",
        message: applicationError.message,
      }));
    }
  }
);

inspectionRoutes.post(
  "/:eventCode/inspection/teams/:teamNumber/comment",
  requireAuth,
  async (c) => {
    const payloadResult = await getInspectionTeamPayload(
      c,
      saveCommentBodySchema,
      getInspectorEventCode
    );
    if (!payloadResult.ok) {
      return payloadResult.response;
    }
    const { eventCode, payload, teamNumber } = payloadResult.value;

    try {
      saveInspectionCommentUseCase.execute({
        eventCode,
        teamNumber,
        comment: payload.comment,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "COMMENT_UPDATED",
        teamNumber,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json({ success: true });
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to save inspection comment",
        message: applicationError.message,
      }));
    }
  }
);

inspectionRoutes.get(
  "/:eventCode/inspection/teams/:teamNumber/history",
  requireAuth,
  (c) => {
    const teamContextResult = getInspectionTeamContext(c, getInspectorEventCode);
    if (!teamContextResult.ok) {
      return teamContextResult.response;
    }

    try {
      const result = getInspectionHistoryUseCase.execute({
        eventCode: teamContextResult.value.eventCode,
        teamNumber: teamContextResult.value.teamNumber,
      });
      return c.json(result);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to load inspection history",
        message: applicationError.message,
      }));
    }
  }
);

inspectionRoutes.post(
  "/:eventCode/inspection/teams/:teamNumber/override",
  requireAuth,
  async (c) => {
    const payloadResult = await getInspectionTeamPayload(
      c,
      overrideStatusBodySchema,
      getLeadInspectorEventCode
    );
    if (!payloadResult.ok) {
      return payloadResult.response;
    }
    const { eventCode, payload, teamNumber } = payloadResult.value;

    try {
      const auth = c.get("auth");
      const detail = applyOverrideUseCase.execute({
        eventCode,
        teamNumber,
        comment: payload.comment,
        changedBy: auth.sub,
      });
      inspectionSyncHub.publish({
        eventCode,
        kind: "OVERRIDE_APPLIED",
        teamNumber,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(detail);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to override inspection status",
        message: applicationError.message,
      }));
    }
  }
);

inspectionRoutes.get("/:eventCode/inspection/public-status", (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const result = getPublicStatusUseCase.execute({ eventCode });
    return c.json(result);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to load public inspection status",
      message: applicationError.message,
    }));
  }
});
