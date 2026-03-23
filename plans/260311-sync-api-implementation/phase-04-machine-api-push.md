# Phase 4: Machine API - Push Endpoint

## Overview

**Priority:** Critical (Core sync functionality)
**Status:** Pending
**Effort:** ~90 minutes

Implement `POST /api/sync/v1/machine/push` for sync clients to submit data batches.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/bun/server/api/sync/sync.service.ts` | Add push handling logic |
| `src/bun/server/api/sync/sync.routes.ts` | Add push endpoint |

---

## Service Layer Extensions

### Payload Hash Calculation

```typescript
import { createHash } from "node:crypto";

function calculatePayloadHash(payload: unknown): string {
  const canonical = JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(canonical).digest("hex");
}
```

### Push Batch Input/Output

```typescript
interface PushBatchInput {
  clientId: string;
  eventCode: string;
  allowedResources: string[];
  payload: PushSyncBatchRequest;
}

interface PushResult {
  batchId: string;
  changeSetId?: string;
  status: "applied" | "pending_review" | "duplicate";
  warnings: Array<{ code: string; message: string; resourceType?: string; recordKey?: string }>;
}
```

### Main Push Handler

```typescript
export function pushSyncBatch(input: PushBatchInput): PushResult {
  const { clientId, eventCode, allowedResources, payload } = input;

  // 1. Validate definitionVersion
  if (payload.definitionVersion !== "2025.1") {
    throw new Error(`Unsupported definitionVersion: ${payload.definitionVersion}`);
  }

  // 2. Validate resource types against allowed list
  for (const resource of payload.resources) {
    if (!allowedResources.includes(resource.resourceType)) {
      throw new Error(`Resource type ${resource.resourceType} not allowed`);
    }
  }

  // 3. Check for duplicate (idempotency)
  const payloadHash = calculatePayloadHash(payload);
  const existingBatch = db
    .select()
    .from(schema.syncBatches)
    .where(
      and(
        eq(schema.syncBatches.clientId, clientId),
        eq(schema.syncBatches.batchId, payload.batchId)
      )
    )
    .get();

  if (existingBatch) {
    if (existingBatch.payloadHash === payloadHash) {
      return {
        batchId: payload.batchId,
        changeSetId: existingBatch.changeSetId,
        status: "duplicate",
        warnings: [],
      };
    } else {
      throw new Error("BATCH_HASH_MISMATCH");
    }
  }

  // 4. Validate records and collect warnings
  const warnings: Array<{ code: string; message: string; resourceType?: string; recordKey?: string }> = [];
  const changeSets: Array<{ resourceType: string; mode: string; records: unknown[] }> = [];

  for (const resource of payload.resources) {
    // Check for duplicate keys within batch
    const keys = new Set<string>();
    for (const record of resource.records) {
      const key = getRecordBusinessKey(resource.resourceType, record);
      if (keys.has(key)) {
        throw new Error(`Duplicate record key ${key} for ${resource.resourceType}`);
      }
      keys.add(key);

      // Validate team references
      const teamWarnings = validateTeamReferences(resource.resourceType, record, eventCode);
      warnings.push(...teamWarnings);
    }

    changeSets.push({
      resourceType: resource.resourceType,
      mode: resource.mode,
      records: resource.records,
    });
  }

  // 5. Determine status based on policy and warnings
  const hasWarnings = warnings.length > 0;
  const policy = getSyncPolicy(eventCode);
  const needsReview = policy.reviewMode === "MANUAL_REVIEW" || hasWarnings;
  const status = needsReview ? "pending_review" : "applied";

  // 6. Create batch record
  const batchId = crypto.randomUUID();
  const changeSetId = needsReview ? crypto.randomUUID() : undefined;

  db.insert(schema.syncBatches).values({
    id: batchId,
    pushBatchId: payload.batchId,
    changeSetId,
    clientId,
    eventCode,
    status,
    batchId: payload.batchId,
    payloadHash,
    rawPayload: payload,
    warnings,
    createdAt: Date.now(),
  }).run();

  // 7. If auto-accept, apply changes immediately
  if (status === "applied") {
    applyChangeSets(eventCode, changeSets);
  }

  return {
    batchId: payload.batchId,
    changeSetId,
    status,
    warnings,
  };
}
```

### Helper Functions

```typescript
function getRecordBusinessKey(resourceType: string, record: unknown): string {
  switch (resourceType) {
    case "inspection_schedule":
    case "inspection_results":
      return `${(record as any).teamNumber}_${(record as any).stage}`;
    case "match_schedule":
    case "match_results":
      return (record as any).matchKey;
    case "team_rankings":
      return (record as any).teamNumber;
    case "team_awards":
      return (record as any).awardCode;
    default:
      return JSON.stringify(record);
  }
}

function validateTeamReferences(
  resourceType: string,
  record: unknown,
  eventCode: string
): Array<{ code: string; message: string; resourceType?: string; recordKey?: string }> {
  const warnings: Array<{ code: string; message: string; resourceType?: string; recordKey?: string }> = [];

  // Get registered teams for event
  const registeredTeams = new Set<string>();
  // TODO: Query actual teams from database

  const teamNumbers: string[] = [];
  if (resourceType.includes("match")) {
    const alliances = (record as any).alliances ?? [];
    for (const alliance of alliances) {
      teamNumbers.push(...(alliance.teamNumbers ?? []));
    }
  } else if (resourceType.includes("inspection") || resourceType === "team_rankings") {
    teamNumbers.push((record as any).teamNumber);
  }

  for (const teamNumber of teamNumbers) {
    if (!registeredTeams.has(teamNumber)) {
      warnings.push({
        code: "UNKNOWN_TEAM_REFERENCE",
        message: `Team ${teamNumber} is not registered for this event`,
        resourceType,
        recordKey: getRecordBusinessKey(resourceType, record),
      });
    }
  }

  return warnings;
}

function getSyncPolicy(eventCode: string) {
  return db
    .select()
    .from(schema.syncPolicies)
    .where(eq(schema.syncPolicies.eventCode, eventCode))
    .get();
}
```

### Change Set Application (stub for now)

```typescript
function applyChangeSets(
  eventCode: string,
  changeSets: Array<{ resourceType: string; mode: string; records: unknown[] }>
) {
  // TODO: Implement actual data application logic
  // This will be expanded in Phase 4b
  for (const cs of changeSets) {
    // Apply each resource type
  }
}
```

---

## Route Handler

```typescript
import { pushSyncBatchRequestSchema, type PushSyncBatchRequest } from "./sync.schema";

syncRoutes.post("/machine/push", async (c) => {
  const authorization = c.req.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return c.json({ error: "UNAUTHORIZED", message: "Bearer token required" }, 401);
  }

  const token = authorization.replace(/^Bearer\s+/i, "");

  try {
    const auth = authenticateSyncClient(token);
    const body = await c.req.json();

    // Validate payload schema
    const result = safeParse(pushSyncBatchRequestSchema, body);
    if (!result.success) {
      return c.json(
        { error: "VALIDATION_FAILED", issues: result.issues },
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
      warnings: pushResult.warnings.length > 0 ? pushResult.warnings : undefined,
    });
  } catch (error) {
    if (error instanceof Error) {
      const errorCodes: Record<string, number> = {
        "Invalid sync client credentials": 401,
        "CLIENT_REVOKED": 403,
        "SYNC_DISABLED": 403,
        "RESOURCE_TYPE_NOT_ALLOWED": 403,
        "VALIDATION_FAILED": 400,
        "BATCH_HASH_MISMATCH": 409,
      };
      const message = error.message;
      return c.json({ error: message }, errorCodes[message] ?? 500);
    }
    throw error;
  }
});
```

---

## Implementation Steps

1. Add `calculatePayloadHash` to `sync.utils.ts`
2. Extend `sync.service.ts` with push handler + helpers
3. Add POST `/machine/push` route to `sync.routes.ts`
4. Run `bun run typecheck`

---

## Success Criteria

- [ ] POST endpoint accepts valid push requests
- [ ] Returns 401 without auth
- [ ] Returns 400 for invalid payloads
- [ ] Detects duplicate batches (idempotency)
- [ ] Routes warnings to pending_review when appropriate
- [ ] TypeScript compiles without errors

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Composite idempotency key | `clientId + batchId + payloadHash` prevents replays |
| Warnings trigger review | Guardrails without blocking legitimate updates |
| Synchronous application | Simple for single-server; can async later |

---

## Dependencies

- Phase 1: Database Schema
- Phase 2: Core Types
- Phase 3: Machine API Bootstrap (auth pattern)

---

## Next Phase

→ Phase 5: Admin API - Client Management
