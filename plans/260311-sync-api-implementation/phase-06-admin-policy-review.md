# Phase 6: Admin API - Policy & Batch Review

## Overview

**Priority:** High (Completes admin workflow)
**Status:** Pending
**Effort:** ~75 minutes

Implement policy management and batch review endpoints.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/bun/server/api/sync/sync.routes.ts` | Add 5 admin endpoints |

---

## Endpoints

### 1. Get Policy

**GET** `/api/sync/v1/admin/seasons/:season/events/:eventCode/policy`

```typescript
syncRoutes.get(
  "/admin/seasons/:season/events/:eventCode/policy",
  requireAuth,
  (c) => {
    const { season, eventCode } = c.req.param();

    if (season !== "2025") {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) return forbidden;

    const policy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();

    if (!policy) {
      // Return default policy
      return c.json({
        eventKey: `${season}/${eventCode}`,
        isSyncEnabled: false,
        reviewMode: "AUTO_ACCEPT",
        scheduleOwner: "WEB",
        allowedPushResources: [],
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
```

### 2. Update Policy

**POST** `/api/sync/v1/admin/seasons/:season/events/:eventCode/policy`

```typescript
import { updateSyncPolicyRequestSchema } from "./sync.schema";

syncRoutes.post(
  "/admin/seasons/:season/events/:eventCode/policy",
  requireAuth,
  async (c) => {
    const { season, eventCode } = c.req.param();
    const auth = c.get("auth");

    if (season !== "2025") {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) return forbidden;

    const body = await c.req.json();
    const result = safeParse(updateSyncPolicyRequestSchema, body);
    if (!result.success) {
      return c.json({ error: "Validation failed" }, 400);
    }

    const now = Date.now();

    // Upsert policy
    db.insert(schema.syncPolicies)
      .values({
        eventCode,
        isSyncEnabled: result.output.isSyncEnabled ?? false,
        reviewMode: result.output.reviewMode ?? "AUTO_ACCEPT",
        scheduleOwner: result.output.scheduleOwner ?? "WEB",
        allowedPushResources: result.output.allowedPushResources ?? [],
        updatedAt: now,
        updatedBy: auth.sub,
      })
      .onConflictDoUpdate({
        target: schema.syncPolicies.eventCode,
        set: {
          isSyncEnabled: result.output.isSyncEnabled,
          reviewMode: result.output.reviewMode,
          scheduleOwner: result.output.scheduleOwner,
          allowedPushResources: result.output.allowedPushResources,
          updatedAt: now,
          updatedBy: auth.sub,
        },
      })
      .run();

    const updatedPolicy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get()!;

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
```

### 3. List Batches

**GET** `/api/sync/v1/admin/seasons/:season/events/:eventCode/batches`

```typescript
syncRoutes.get(
  "/admin/seasons/:season/events/:eventCode/batches",
  requireAuth,
  (c) => {
    const { season, eventCode } = c.req.param();
    const status = c.req.query("status");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "25", 10), 100);

    if (season !== "2025") {
      return c.json({ error: "Unsupported season" }, 400);
    }

    const forbidden = requireEventAdmin(c, eventCode);
    if (forbidden) return forbidden;

    let query = db
      .select()
      .from(schema.syncBatches)
      .where(eq(schema.syncBatches.eventCode, eventCode));

    if (status) {
      query = query.and(eq(schema.syncBatches.status, status));
    }

    const batches = query.limit(limit).all();

    return c.json({
      batches: batches.map((batch) => ({
        pushBatchId: batch.pushBatchId,
        changeSetId: batch.changeSetId,
        batchId: batch.batchId,
        status: batch.status,
        resourceCount: "0", // TODO: Count from syncChangeSets
        createdAt: new Date(batch.createdAt).toISOString(),
        reviewedAt: batch.reviewedAt ? new Date(batch.reviewedAt).toISOString() : undefined,
        reviewerId: batch.reviewerId,
      })),
      nextCursor: undefined,
      hasMore: batches.length === limit,
    });
  }
);
```

### 4. Get Batch Detail

**GET** `/api/sync/v1/admin/batches/:pushBatchId`

```typescript
syncRoutes.get(
  "/admin/batches/:pushBatchId",
  requireAuth,
  (c) => {
    const { pushBatchId } = c.req.param();
    const forbidden = requireAuth(c);
    if (forbidden) return forbidden;

    const batch = db
      .select()
      .from(schema.syncBatches)
      .where(eq(schema.syncBatches.pushBatchId, pushBatchId))
      .get();

    if (!batch) {
      return c.json({ error: "Batch not found" }, 404);
    }

    const client = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.id, batch.clientId))
      .get();

    // Get change sets for this batch
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
      eventKey: `2025/${batch.eventCode}`,
      clientId: batch.clientId,
      clientName: client?.name ?? "Unknown",
      createdAt: new Date(batch.createdAt).toISOString(),
      reviewedAt: batch.reviewedAt ? new Date(batch.reviewedAt).toISOString() : undefined,
      reviewerId: batch.reviewerId,
      reviewReason: batch.reviewReason,
      resources: changeSets.map((cs) => ({
        resourceType: cs.resourceType,
        recordCount: String(cs.recordCount),
        mode: cs.mode,
      })),
      warnings: batch.warnings ?? [],
      diff: undefined, // TODO: Compute from staged vs applied data
      rawPayload: batch.rawPayload,
    });
  }
);
```

### 5. Review Batch

**POST** `/api/sync/v1/admin/batches/:changeSetId/review`

```typescript
import { reviewSyncBatchRequestSchema } from "./sync.schema";

syncRoutes.post(
  "/admin/batches/:changeSetId/review",
  requireAuth,
  async (c) => {
    const { changeSetId } = c.req.param();
    const auth = c.get("auth");

    const forbidden = requireEventAdmin(c, "*");
    if (forbidden) return forbidden;

    const body = await c.req.json();
    const result = safeParse(reviewSyncBatchRequestSchema, body);
    if (!result.success) {
      return c.json({ error: "Validation failed" }, 400);
    }

    const batch = db
      .select()
      .from(schema.syncBatches)
      .where(eq(schema.syncBatches.changeSetId, changeSetId))
      .get();

    if (!batch) {
      return c.json({ error: "Batch not found" }, 404);
    }

    if (batch.status !== "pending_review") {
      return c.json({ error: "BATCH_ALREADY_REVIEWED" }, 409);
    }

    const decision = result.output.decision.toUpperCase();
    const newStatus = decision === "APPROVE" || decision === "APPROVED"
      ? "applied"
      : "rejected";

    const now = Date.now();

    db.update(schema.syncBatches)
      .set({
        status: newStatus,
        reviewedAt: now,
        reviewerId: auth.sub,
        reviewReason: result.output.reason,
      })
      .where(eq(schema.syncBatches.changeSetId, changeSetId))
      .run();

    // If approved, apply the change sets
    if (newStatus === "applied") {
      const changeSets = db
        .select()
        .from(schema.syncChangeSets)
        .where(eq(schema.syncChangeSets.batchId, batch.id))
        .all();

      applyChangeSets(batch.eventCode, changeSets);
    }

    return c.json({
      success: true,
      changeSetId,
      newStatus,
      reviewedAt: new Date(now).toISOString(),
    });
  }
);
```

---

## Implementation Steps

1. Add 5 endpoints to `sync.routes.ts`
2. Import `applyChangeSets` from service layer
3. Run `bun run typecheck`

---

## Success Criteria

- [ ] GET/POST policy endpoints work
- [ ] GET batches list with status filter
- [ ] GET batch detail with change sets
- [ ] POST review batch (approve/reject)
- [ ] Approved batches trigger change application
- [ ] TypeScript compiles without errors

---

## Review Workflow

```
pushSyncBatch (with warnings)
    → pending_review
    → GET /batches (list pending)
    → GET /batches/:id (review details)
    → POST /batches/:id/review (APPROVE/REJECT)
    → applied OR rejected
```

---

## Dependencies

- Phase 1: Database Schema
- Phase 4: Machine API Push (applyChangeSets function)

---

## Next Phase

→ Phase 7: Integration & Route Registration
