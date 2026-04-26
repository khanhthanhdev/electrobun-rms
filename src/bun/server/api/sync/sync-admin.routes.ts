import type { Context } from "hono";
import { Hono } from "hono";
import type { BaseIssue, BaseSchema, InferOutput } from "valibot";
import { outboundSyncPushService } from "../../infrastructure/services/outbound-sync-push-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin, requireGlobalAdmin } from "../common/guards";
import {
  getSeasonEventCodeWithGuard,
  parseJsonBodyOrResponse,
  safeParseOrResponse,
} from "../common/route-handler-helpers";
import {
  createSyncClientRequestSchema,
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  reviewSyncBatchRequestSchema,
  SYNC_SEASON,
  updateSyncPolicyRequestSchema,
} from "./sync.schema";
import {
  applySyncBatchReviewUseCase,
  createSyncClientUseCase,
  getSyncBatchDetailUseCase,
  getSyncBatchReviewCandidateUseCase,
  getSyncPolicyUseCase,
  listSyncBatchesUseCase,
  listSyncClientsUseCase,
  revokeSyncClientUseCase,
  toSyncErrorResponse,
  updateSyncPolicyUseCase,
} from "./sync.shared";

export const syncAdminRoutes = new Hono<AppEnv>();

const getSyncAdminEventCode = (c: Context<AppEnv>) =>
  getSeasonEventCodeWithGuard(c, SYNC_SEASON, requireEventAdmin, {
    error: "Unsupported season",
  });

const parseSyncAdminSchemaBody = async <
  TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(
  c: Context<AppEnv>,
  schema: TSchema,
  mergeFields: Record<string, unknown>
): Promise<
  { ok: true; value: InferOutput<TSchema> } | { ok: false; response: Response }
> => {
  const bodyResult = await parseJsonBodyOrResponse(
    c,
    { error: "Validation failed", message: "Body must be valid JSON." },
    400
  );
  if (!bodyResult.ok) {
    return bodyResult;
  }

  return safeParseOrResponse(
    c,
    schema,
    {
      ...(bodyResult.value as Record<string, unknown>),
      ...mergeFields,
    },
    (issues) => ({ error: "Validation failed", issues })
  );
};

// List Clients
syncAdminRoutes.get(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  async (c) => {
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    const clients = await listSyncClientsUseCase.execute({
      eventCode: eventCodeResult.value,
    });
    return c.json({ clients });
  }
);

// Create Client
syncAdminRoutes.post(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  async (c) => {
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    const result = await parseSyncAdminSchemaBody(
      c,
      createSyncClientRequestSchema,
      { eventCode: eventCodeResult.value, season: SYNC_SEASON }
    );
    if (!result.ok) {
      return result.response;
    }

    const createdClient = await createSyncClientUseCase.execute({
      allowedResources:
        result.value.allowedResources ?? DEFAULT_ALLOWED_PUSH_RESOURCES,
      eventCode: eventCodeResult.value,
      expiresAt: result.value.expiresAt,
      name: result.value.name,
    });
    return c.json(createdClient);
  }
);

// Revoke Client
syncAdminRoutes.post(
  "/admin/clients/:clientId/revoke",
  requireAuth,
  async (c) => {
    const { clientId } = c.req.param();
    const forbidden = requireGlobalAdmin(c);
    if (forbidden) {
      return forbidden;
    }

    const revoked = await revokeSyncClientUseCase.execute({ clientId });
    if (!revoked) {
      return c.json({ error: "Client not found" }, 404);
    }
    return c.json({ success: true, clientId });
  }
);

// Get Policy
syncAdminRoutes.get(
  "/admin/seasons/:season/events/:eventCode/policy",
  requireAuth,
  async (c) => {
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    const policy = await getSyncPolicyUseCase.execute({
      eventCode: eventCodeResult.value,
    });
    return c.json(policy);
  }
);

// Get Outbound Sync Status
syncAdminRoutes.get(
  "/admin/seasons/:season/events/:eventCode/outbound-status",
  requireAuth,
  async (c) => {
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    const status = await outboundSyncPushService.getEventStatus(
      eventCodeResult.value
    );
    return c.json(status);
  }
);

// Retry Outbound Sync
syncAdminRoutes.post(
  "/admin/seasons/:season/events/:eventCode/outbound-retry",
  requireAuth,
  async (c) => {
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    try {
      const result = await outboundSyncPushService.requestImmediateRetry(
        eventCodeResult.value
      );
      return c.json({
        batchId: result.batchId,
        eventCode: eventCodeResult.value,
        success: true,
      });
    } catch (error) {
      const response = toSyncErrorResponse(error);
      return c.json(response.body, response.status);
    }
  }
);

// Update Policy
syncAdminRoutes.post(
  "/admin/seasons/:season/events/:eventCode/policy",
  requireAuth,
  async (c) => {
    const auth = c.get("auth");
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    const result = await parseSyncAdminSchemaBody(
      c,
      updateSyncPolicyRequestSchema,
      { eventCode: eventCodeResult.value, season: SYNC_SEASON }
    );
    if (!result.ok) {
      return result.response;
    }

    const updatedPolicy = await updateSyncPolicyUseCase.execute({
      allowedPushResources:
        result.value.allowedPushResources ?? DEFAULT_ALLOWED_PUSH_RESOURCES,
      eventCode: eventCodeResult.value,
      isSyncEnabled: result.value.isSyncEnabled,
      reviewMode: result.value.reviewMode,
      scheduleOwner: result.value.scheduleOwner,
      updatedBy: auth.sub,
    });
    return c.json({ success: true, policy: updatedPolicy });
  }
);

// List Batches
syncAdminRoutes.get(
  "/admin/seasons/:season/events/:eventCode/batches",
  requireAuth,
  async (c) => {
    const status = c.req.query("status");
    const limit = Math.min(
      Number.parseInt(c.req.query("limit") ?? "25", 10),
      100
    );
    const eventCodeResult = getSyncAdminEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }

    const batches = await listSyncBatchesUseCase.execute({
      eventCode: eventCodeResult.value,
      limit,
      status,
    });
    return c.json(batches);
  }
);

// Get Batch Detail
syncAdminRoutes.get("/admin/batches/:pushBatchId", requireAuth, async (c) => {
  const { pushBatchId } = c.req.param();
  const batch = await getSyncBatchDetailUseCase.execute({ pushBatchId });
  if (!batch) {
    return c.json({ error: "Batch not found" }, 404);
  }
  const forbidden = requireEventAdmin(c, batch.eventCode);
  if (forbidden) {
    return forbidden;
  }

  const { eventCode: _eventCode, ...responseBody } = batch;
  return c.json(responseBody);
});

// Review Batch
syncAdminRoutes.post(
  "/admin/batches/:changeSetId/review",
  requireAuth,
  async (c) => {
    const { changeSetId } = c.req.param();
    const auth = c.get("auth");

    const batch = await getSyncBatchReviewCandidateUseCase.execute({
      changeSetId,
    });
    if (!batch) {
      return c.json({ error: "Batch not found" }, 404);
    }
    const forbidden = requireEventAdmin(c, batch.eventCode);
    if (forbidden) {
      return forbidden;
    }

    const result = await parseSyncAdminSchemaBody(
      c,
      reviewSyncBatchRequestSchema,
      { changeSetId }
    );
    if (!result.ok) {
      return result.response;
    }

    try {
      const reviewResult = await applySyncBatchReviewUseCase.execute({
        changeSetId,
        decision: result.value.decision,
        reason: result.value.reason,
        reviewerId: auth.sub,
      });
      return c.json(reviewResult);
    } catch (error) {
      const response = toSyncErrorResponse(error);
      return c.json(response.body, response.status);
    }
  }
);
