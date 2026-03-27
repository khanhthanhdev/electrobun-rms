import { Hono } from "hono";
import { safeParse } from "valibot";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin, requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
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
  updateSyncPolicyUseCase,
} from "./sync.shared";

export const syncAdminRoutes = new Hono<AppEnv>();

// List Clients
syncAdminRoutes.get(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  async (c) => {
    const { season, eventCode } = c.req.param();
    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }
    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const clients = await listSyncClientsUseCase.execute({ eventCode });
    return c.json({ clients });
  }
);

// Create Client
syncAdminRoutes.post(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  async (c) => {
    const { season, eventCode } = c.req.param();
    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }
    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json(
        { error: "Validation failed", message: "Body must be valid JSON." },
        400
      );
    }

    const result = safeParse(createSyncClientRequestSchema, {
      ...(body as Record<string, unknown>),
      eventCode,
      season,
    });
    if (!result.success) {
      return c.json({ error: "Validation failed", issues: result.issues }, 400);
    }

    const createdClient = await createSyncClientUseCase.execute({
      allowedResources:
        result.output.allowedResources ?? DEFAULT_ALLOWED_PUSH_RESOURCES,
      eventCode,
      expiresAt: result.output.expiresAt,
      name: result.output.name,
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
    const { season, eventCode } = c.req.param();
    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }
    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const policy = await getSyncPolicyUseCase.execute({ eventCode });
    return c.json(policy);
  }
);

// Update Policy
syncAdminRoutes.post(
  "/admin/seasons/:season/events/:eventCode/policy",
  requireAuth,
  async (c) => {
    const { season, eventCode } = c.req.param();
    const auth = c.get("auth");
    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }
    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json(
        { error: "Validation failed", message: "Body must be valid JSON." },
        400
      );
    }

    const result = safeParse(updateSyncPolicyRequestSchema, {
      ...(body as Record<string, unknown>),
      eventCode,
      season,
    });
    if (!result.success) {
      return c.json({ error: "Validation failed", issues: result.issues }, 400);
    }

    const updatedPolicy = await updateSyncPolicyUseCase.execute({
      allowedPushResources:
        result.output.allowedPushResources ?? DEFAULT_ALLOWED_PUSH_RESOURCES,
      eventCode,
      isSyncEnabled: result.output.isSyncEnabled,
      reviewMode: result.output.reviewMode,
      scheduleOwner: result.output.scheduleOwner,
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
    const { season, eventCode } = c.req.param();
    const status = c.req.query("status");
    const limit = Math.min(
      Number.parseInt(c.req.query("limit") ?? "25", 10),
      100
    );
    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }
    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const batches = await listSyncBatchesUseCase.execute({
      eventCode,
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

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json(
        { error: "Validation failed", message: "Body must be valid JSON." },
        400
      );
    }

    const result = safeParse(reviewSyncBatchRequestSchema, {
      ...(body as Record<string, unknown>),
      changeSetId,
    });
    if (!result.success) {
      return c.json({ error: "Validation failed", issues: result.issues }, 400);
    }

    const reviewResult = await applySyncBatchReviewUseCase.execute({
      changeSetId,
      decision: result.output.decision,
      reason: result.output.reason,
      reviewerId: auth.sub,
    });
    return c.json(reviewResult);
  }
);
