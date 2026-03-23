# Phase 7: Integration & Testing

## Overview

**Priority:** Critical (Final integration)
**Status:** Pending
**Effort:** ~30 minutes

Register sync routes with main API and add integration tests.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/bun/server/api/index.ts` | Register sync routes |
| `tests/sync/sync-integration.test.ts` | Create integration tests (optional) |

---

## Route Registration

```typescript
// src/bun/server/api/index.ts

import { syncRoutes } from "./sync/sync.routes";

// Add to existing API routes
api.route("/sync", syncRoutes);
```

---

## Full Endpoint List

After integration, these endpoints will be available:

### Machine API (Bearer Token Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sync/v1/machine/bootstrap` | Fetch initial event data |
| POST | `/api/sync/v1/machine/push` | Submit data batch |

### Admin API (Session Auth)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/sync/v1/admin/seasons/:season/events/:eventCode/clients` | List sync clients |
| POST | `/api/sync/v1/admin/seasons/:season/events/:eventCode/clients` | Create sync client |
| POST | `/api/sync/v1/admin/clients/:clientId/revoke` | Revoke client |
| GET | `/api/sync/v1/admin/seasons/:season/events/:eventCode/policy` | Get sync policy |
| POST | `/api/sync/v1/admin/seasons/:season/events/:eventCode/policy` | Update sync policy |
| GET | `/api/sync/v1/admin/seasons/:season/events/:eventCode/batches` | List batches |
| GET | `/api/sync/v1/admin/batches/:pushBatchId` | Get batch details |
| POST | `/api/sync/v1/admin/batches/:changeSetId/review` | Review batch |

---

## Integration Test (Optional)

```typescript
// tests/sync/sync-integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { db, schema } from "../../src/bun/db";
import { generateSecret, hashSync } from "../../src/bun/server/api/sync/sync.utils";

describe("Sync API", () => {
  let clientSecret: string;
  let clientId: string;

  beforeAll(async () => {
    // Setup: Create test client via Admin API
    // This would require a test HTTP server instance
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    await db.delete(schema.syncBatches).run();
    await db.delete(schema.syncClients).run();
    await db.delete(schema.syncPolicies).run();
  });

  describe("Machine API", () => {
    it("should reject unauthenticated bootstrap request", async () => {
      // Test without auth header
      const response = await fetch("/api/sync/v1/machine/bootstrap");
      expect(response.status).toBe(401);
    });

    it("should accept valid bearer token", async () => {
      // Test with valid token
      const response = await fetch("/api/sync/v1/machine/bootstrap", {
        headers: { Authorization: `Bearer ${clientSecret}` },
      });
      expect(response.status).toBe(200);
    });

    it("should handle push request with idempotency", async () => {
      // Test push with same batchId twice
      const payload = {
        schemaVersion: "2026-03-08",
        definitionVersion: "2025.1",
        batchId: "test-batch-001",
        producedAt: new Date().toISOString(),
        resources: [],
      };

      const response1 = await fetch("/api/sync/v1/machine/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const response2 = await fetch("/api/sync/v1/machine/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      // Second should be duplicate
    });
  });

  describe("Admin API", () => {
    it("should create and list client", async () => {
      // Test client creation
    });

    it("should revoke client", async () => {
      // Test client revocation
    });
  });
});
```

---

## Implementation Steps

1. Add `api.route("/sync", syncRoutes)` to `src/bun/server/api/index.ts`
2. Run `bun run typecheck` to verify
3. (Optional) Create integration test file
4. Run `bun test tests/sync/` if tests created

---

## Success Criteria

- [ ] Routes registered without conflicts
- [ ] All endpoints accessible
- [ ] TypeScript compiles without errors
- [ ] (Optional) Integration tests pass

---

## Testing Checklist

### Machine API

- [ ] Bootstrap returns 401 without token
- [ ] Bootstrap returns data with valid token
- [ ] Push accepts valid payload
- [ ] Push rejects invalid payload (400)
- [ ] Push detects duplicate (returns "duplicate" status)
- [ ] Push handles hash mismatch (409)

### Admin API

- [ ] Create client returns secret once
- [ ] List clients shows created client
- [ ] Revoke client marks as revoked
- [ ] Revoked client cannot authenticate
- [ ] Policy update changes review mode
- [ ] Batch review accepts/rejects

---

## Dependencies

- Phase 1-6: All previous phases must be complete

---

## Unresolved Questions

1. **Change Application Logic**: How should `applyChangeSets` actually apply data to main tables?
2. **Team Validation**: Where do registered teams come from for validation?
3. **Diff Computation**: Should diffs be computed at push time or review time?
4. **Multi-season Support**: Schema supports it, but logic hardcoded to 2025

---

## Post-Implementation

After all phases complete:

1. Update `docs/system-architecture.md` with sync API details
2. Update `docs/development-roadmap.md` with completion status
3. Create API documentation for end users
4. Test with actual NRC event control app
