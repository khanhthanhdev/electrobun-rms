import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import { safeParse } from "valibot";
import { db, schema } from "../../../db";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin, requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import {
  EVENT_CODE_VALIDATION_MESSAGE,
  isValidEventCode,
  normalizeEventCode,
} from "../common/patterns";
import {
  createSyncClientRequestSchema,
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  eventBootstrapResponseSchema,
  pushSyncBatchRequestSchema,
  reviewSyncBatchRequestSchema,
  SYNC_SEASON,
  updateSyncPolicyRequestSchema,
} from "./sync.schema";
import {
  applySyncBatch,
  authenticateSyncClient,
  getEventBootstrap,
  isSyncError,
  pushSyncBatch,
} from "./sync.service";
import { generateSecret, hashSync, ulid } from "./sync.utils";
import {
  bootstrapEventFromNrcWeb,
  createLocalEventFromBootstrap,
  getNrcWebBaseUrl,
  setNrcWebBaseUrl,
} from "./sync-bootstrap.service";

export const syncRoutes = new Hono<AppEnv>();

const toSyncErrorResponse = (error: unknown) => {
  if (isSyncError(error)) {
    return {
      body: {
        error: error.code,
        issues: error.issues,
        message: error.message,
      },
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      body: {
        error: "INTERNAL_ERROR",
        message: error.message,
      },
      status: 500 as const,
    };
  }

  return {
    body: {
      error: "INTERNAL_ERROR",
      message: "Unknown sync error.",
    },
    status: 500 as const,
  };
};

// Machine Bootstrap Endpoint
const BEARER_TOKEN_REGEX = /^Bearer\s+/i;

syncRoutes.get("/machine/bootstrap", (c) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      401
    );
  }

  const token = authorization.replace(BEARER_TOKEN_REGEX, "");

  try {
    const auth = authenticateSyncClient(token);
    const bootstrap = getEventBootstrap(auth.eventCode);

    // Validate response schema (dev safety)
    const result = safeParse(eventBootstrapResponseSchema, bootstrap);
    if (!result.success) {
      return c.json(
        {
          error: "INTERNAL_ERROR",
          issues: result.issues,
          message: "Bootstrap response failed schema validation.",
        },
        500
      );
    }

    return c.json(bootstrap);
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});

// Machine Push Endpoint
syncRoutes.post("/machine/push", async (c) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      401
    );
  }

  const token = authorization.replace(BEARER_TOKEN_REGEX, "");

  try {
    const auth = authenticateSyncClient(token);
    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json(
        { error: "VALIDATION_FAILED", message: "Body must be valid JSON." },
        400
      );
    }

    // Validate payload schema
    const result = safeParse(pushSyncBatchRequestSchema, body);
    if (!result.success) {
      return c.json(
        {
          error: "VALIDATION_FAILED",
          issues: result.issues,
          message: "Push payload failed validation.",
        },
        400
      );
    }

    const pushResult = pushSyncBatch({
      clientId: auth.clientId,
      eventCode: auth.eventCode,
      allowedResources: auth.allowedResources,
      payload: result.output,
    });

    return c.json({
      batchId: pushResult.batchId,
      status: pushResult.status,
      changeSetId: pushResult.changeSetId,
      receivedAt: new Date().toISOString(),
      warnings:
        pushResult.warnings.length > 0 ? pushResult.warnings : undefined,
    });
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});

// Admin API: Client Management

// List Clients
syncRoutes.get(
  "/admin/seasons/:season/events/:eventCode/clients",
  requireAuth,
  (c) => {
    const { season, eventCode } = c.req.param();

    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const clients = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.eventCode, eventCode))
      .all();

    return c.json({
      clients: clients.map((client) => ({
        id: client.id,
        eventKey: `${season}/${eventCode}`,
        name: client.name,
        isActive: client.isActive,
        isRevoked: client.isRevoked,
        createdAt: new Date(client.createdAt).toISOString(),
        expiresAt: client.expiresAt
          ? new Date(client.expiresAt).toISOString()
          : undefined,
        lastUsedAt: client.lastUsedAt
          ? new Date(client.lastUsedAt).toISOString()
          : undefined,
        allowedResources: client.allowedResources ?? [],
      })),
    });
  }
);

// Create Client
syncRoutes.post(
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

    // Generate secret
    const secret = generateSecret();
    const secretHash = hashSync(secret);

    // Revoke existing active clients for this event
    db.update(schema.syncClients)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.syncClients.eventCode, eventCode),
          eq(schema.syncClients.isActive, true)
        )
      )
      .run();

    // Create new client
    const clientId = ulid();
    const now = Date.now();
    const expiresAt = result.output.expiresAt
      ? new Date(result.output.expiresAt).getTime()
      : undefined;

    db.insert(schema.syncClients)
      .values({
        id: clientId,
        eventCode,
        name: result.output.name,
        secretHash,
        isActive: true,
        isRevoked: false,
        createdAt: now,
        expiresAt,
        allowedResources:
          result.output.allowedResources ?? DEFAULT_ALLOWED_PUSH_RESOURCES,
      })
      .run();

    // Update sync policy allowed resources
    if (result.output.allowedResources) {
      const existingPolicy = db
        .select()
        .from(schema.syncPolicies)
        .where(eq(schema.syncPolicies.eventCode, eventCode))
        .get();

      db.insert(schema.syncPolicies)
        .values({
          allowedPushResources: result.output.allowedResources,
          eventCode,
          isSyncEnabled: existingPolicy?.isSyncEnabled ?? false,
          reviewMode: existingPolicy?.reviewMode ?? "AUTO_ACCEPT",
          scheduleOwner: existingPolicy?.scheduleOwner ?? "WEB",
          updatedAt: now,
          updatedBy: existingPolicy?.updatedBy,
        })
        .onConflictDoUpdate({
          set: {
            allowedPushResources: result.output.allowedResources,
            updatedAt: now,
          },
          target: schema.syncPolicies.eventCode,
        })
        .run();
    }

    const newClient = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.id, clientId))
      .get();

    if (!newClient) {
      return c.json({ error: "Client not found" }, 404);
    }

    return c.json({
      client: {
        id: newClient.id,
        eventKey: `${season}/${eventCode}`,
        name: newClient.name,
        isActive: newClient.isActive,
        isRevoked: newClient.isRevoked,
        createdAt: new Date(newClient.createdAt).toISOString(),
        expiresAt: newClient.expiresAt
          ? new Date(newClient.expiresAt).toISOString()
          : undefined,
        lastUsedAt: newClient.lastUsedAt
          ? new Date(newClient.lastUsedAt).toISOString()
          : undefined,
        allowedResources: newClient.allowedResources ?? [],
      },
      secret,
      warning: "Store this secret securely. It will not be shown again.",
    });
  }
);

// Revoke Client
syncRoutes.post("/admin/clients/:clientId/revoke", requireAuth, (c) => {
  const { clientId } = c.req.param();

  // Only global admin can revoke
  const forbidden = requireGlobalAdmin(c);
  if (forbidden) {
    return forbidden;
  }

  const client = db
    .select()
    .from(schema.syncClients)
    .where(eq(schema.syncClients.id, clientId))
    .get();

  if (!client) {
    return c.json({ error: "Client not found" }, 404);
  }

  db.update(schema.syncClients)
    .set({ isRevoked: true, isActive: false })
    .where(eq(schema.syncClients.id, clientId))
    .run();

  return c.json({ success: true, clientId });
});

// Admin API: Policy Management

// Get Policy
syncRoutes.get(
  "/admin/seasons/:season/events/:eventCode/policy",
  requireAuth,
  (c) => {
    const { season, eventCode } = c.req.param();

    if (season !== SYNC_SEASON) {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) {
      return forbidden;
    }

    const policy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();

    if (!policy) {
      return c.json({
        eventKey: `${season}/${eventCode}`,
        isSyncEnabled: false,
        reviewMode: "AUTO_ACCEPT",
        scheduleOwner: "WEB",
        allowedPushResources: DEFAULT_ALLOWED_PUSH_RESOURCES,
        updatedAt: new Date().toISOString(),
      });
    }

    return c.json({
      eventKey: `${season}/${eventCode}`,
      isSyncEnabled: policy.isSyncEnabled,
      reviewMode: policy.reviewMode,
      scheduleOwner: policy.scheduleOwner,
      allowedPushResources: policy.allowedPushResources ?? [],
      updatedAt: new Date(policy.updatedAt).toISOString(),
    });
  }
);

// Update Policy
syncRoutes.post(
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

    const now = Date.now();
    const existingPolicy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();

    db.insert(schema.syncPolicies)
      .values({
        eventCode,
        isSyncEnabled:
          result.output.isSyncEnabled ?? existingPolicy?.isSyncEnabled ?? false,
        reviewMode:
          result.output.reviewMode ??
          existingPolicy?.reviewMode ??
          "AUTO_ACCEPT",
        scheduleOwner:
          result.output.scheduleOwner ?? existingPolicy?.scheduleOwner ?? "WEB",
        allowedPushResources:
          result.output.allowedPushResources ??
          existingPolicy?.allowedPushResources ??
          DEFAULT_ALLOWED_PUSH_RESOURCES,
        updatedAt: now,
        updatedBy: auth.sub,
      })
      .onConflictDoUpdate({
        target: schema.syncPolicies.eventCode,
        set: {
          isSyncEnabled:
            result.output.isSyncEnabled ??
            existingPolicy?.isSyncEnabled ??
            false,
          reviewMode:
            result.output.reviewMode ??
            existingPolicy?.reviewMode ??
            "AUTO_ACCEPT",
          scheduleOwner:
            result.output.scheduleOwner ??
            existingPolicy?.scheduleOwner ??
            "WEB",
          allowedPushResources:
            result.output.allowedPushResources ??
            existingPolicy?.allowedPushResources ??
            DEFAULT_ALLOWED_PUSH_RESOURCES,
          updatedAt: now,
          updatedBy: auth.sub,
        },
      })
      .run();

    const updatedPolicy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();

    if (!updatedPolicy) {
      return c.json({ error: "Policy not found" }, 404);
    }

    return c.json({
      success: true,
      policy: {
        eventKey: `${season}/${eventCode}`,
        isSyncEnabled: updatedPolicy.isSyncEnabled,
        reviewMode: updatedPolicy.reviewMode,
        scheduleOwner: updatedPolicy.scheduleOwner,
        allowedPushResources: updatedPolicy.allowedPushResources ?? [],
        updatedAt: new Date(updatedPolicy.updatedAt).toISOString(),
      },
    });
  }
);

// Admin API: Batch Review

// List Batches
syncRoutes.get(
  "/admin/seasons/:season/events/:eventCode/batches",
  requireAuth,
  (c) => {
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

    const whereConditions = status
      ? and(
          eq(schema.syncBatches.eventCode, eventCode),
          eq(schema.syncBatches.status, status)
        )
      : eq(schema.syncBatches.eventCode, eventCode);

    const batches = db
      .select()
      .from(schema.syncBatches)
      .where(whereConditions)
      .limit(limit)
      .all();

    return c.json({
      batches: batches.map((batch) => ({
        pushBatchId: batch.pushBatchId,
        changeSetId: batch.changeSetId,
        batchId: batch.batchId,
        status: batch.status,
        resourceCount: String(
          Array.isArray(
            (batch.rawPayload as { resources?: unknown[] } | null)?.resources
          )
            ? (batch.rawPayload as { resources: unknown[] }).resources.length
            : 0
        ),
        createdAt: new Date(batch.createdAt).toISOString(),
        reviewedAt: batch.reviewedAt
          ? new Date(batch.reviewedAt).toISOString()
          : undefined,
        reviewerId: batch.reviewerId,
      })),
      nextCursor: undefined,
      hasMore: batches.length === limit,
    });
  }
);

// Get Batch Detail
syncRoutes.get("/admin/batches/:pushBatchId", requireAuth, (c) => {
  const { pushBatchId } = c.req.param();

  const batch = db
    .select()
    .from(schema.syncBatches)
    .where(eq(schema.syncBatches.pushBatchId, pushBatchId))
    .get();

  if (!batch) {
    return c.json({ error: "Batch not found" }, 404);
  }

  const forbidden = requireEventAdmin(c, batch.eventCode);
  if (forbidden) {
    return forbidden;
  }

  const client = db
    .select()
    .from(schema.syncClients)
    .where(eq(schema.syncClients.id, batch.clientId))
    .get();

  const changeSets = db
    .select()
    .from(schema.syncChangeSets)
    .where(eq(schema.syncChangeSets.batchId, batch.id))
    .all();

  return c.json({
    pushBatchId: batch.pushBatchId,
    changeSetId: batch.changeSetId,
    batchId: batch.batchId,
    status: batch.status,
    eventKey: `${SYNC_SEASON}/${batch.eventCode}`,
    clientId: batch.clientId,
    clientName: client?.name ?? "Unknown",
    createdAt: new Date(batch.createdAt).toISOString(),
    reviewedAt: batch.reviewedAt
      ? new Date(batch.reviewedAt).toISOString()
      : undefined,
    reviewerId: batch.reviewerId,
    reviewReason: batch.reviewReason,
    resources: changeSets.map((cs) => ({
      resourceType: cs.resourceType,
      recordCount: String(cs.recordCount),
      mode: cs.mode,
    })),
    warnings: batch.warnings ?? [],
    diff: undefined,
    rawPayload: batch.rawPayload,
  });
});

// Review Batch
syncRoutes.post(
  "/admin/batches/:changeSetId/review",
  requireAuth,
  async (c) => {
    const { changeSetId } = c.req.param();
    const auth = c.get("auth");

    const batch = db
      .select()
      .from(schema.syncBatches)
      .where(eq(schema.syncBatches.changeSetId, changeSetId))
      .get();

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

    if (batch.status !== "pending_review") {
      return c.json({ error: "BATCH_ALREADY_REVIEWED" }, 409);
    }

    const decision = result.output.decision.toUpperCase();
    const newStatus =
      decision === "APPROVE" || decision === "APPROVED"
        ? "applied"
        : "rejected";

    const now = Date.now();

    if (newStatus === "applied") {
      try {
        applySyncBatch(batch.id);
      } catch (error) {
        const response = toSyncErrorResponse(error);
        return c.json(response.body, response.status);
      }
    }

    db.update(schema.syncBatches)
      .set({
        reviewReason: result.output.reason,
        reviewedAt: now,
        reviewerId: auth.sub,
        status: newStatus,
      })
      .where(eq(schema.syncBatches.changeSetId, changeSetId))
      .run();

    return c.json({
      success: true,
      changeSetId,
      newStatus,
      reviewedAt: new Date(now).toISOString(),
    });
  }
);

// NRC Web Config Endpoints

// Get NRC Web Base URL
syncRoutes.get("/config/nrc-web-base-url", requireAuth, (c) => {
  const forbidden = requireGlobalAdmin(c);
  if (forbidden) {
    return forbidden;
  }

  const baseUrl = getNrcWebBaseUrl();
  return c.json({
    baseUrl: baseUrl ?? undefined,
  });
});

// Update NRC Web Base URL
syncRoutes.post("/config/nrc-web-base-url", requireAuth, async (c) => {
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
    const storedBaseUrl = setNrcWebBaseUrl(baseUrl);
    return c.json({ baseUrl: storedBaseUrl, success: true });
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});

// Bootstrap Event from NRC Web
syncRoutes.post("/bootstrap-event", requireAuth, async (c) => {
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

  let baseUrl = getNrcWebBaseUrl() ?? undefined;
  if (typeof payload.baseUrl === "string" && payload.baseUrl.trim()) {
    try {
      baseUrl = setNrcWebBaseUrl(payload.baseUrl);
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
    const result = await bootstrapEventFromNrcWeb({
      baseUrl,
      eventKey,
    });

    const createdEvent = await createLocalEventFromBootstrap(result, eventCode);

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
