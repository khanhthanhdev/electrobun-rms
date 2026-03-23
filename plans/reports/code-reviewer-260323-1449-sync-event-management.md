# Code Review: Sync Event Management UI and Test Coverage

**Commit:** e193def - "feat: add sync event management UI and test coverage"
**BASE_SHA:** ef20aee
**HEAD_SHA:** e193def
**Review Date:** 2026-03-23

---

## Executive Summary

This commit adds a comprehensive sync event management system with:
- Machine-to-machine sync API (bootstrap, push, batch review)
- Real-time display command streaming via SSE
- Admin UI for bootstrapping events from NRC Web

**Total LOC:** ~4,000 lines across 11 files

**Overall Assessment:** Functionally complete with solid architectural patterns, but lacks test coverage for critical sync logic and has one file that significantly exceeds size guidelines.

---

## Critical Issues

### 1. Missing Test Coverage for Core Sync Logic [CRITICAL]

**Files:** `sync.service.ts`, `sync.event-db.ts`, `sync.routes.ts`

The commit message claims "test coverage" but only adds 4 tests for event code validation (`events.schema.test.ts`). The core sync functionality has **zero tests**:

- `pushSyncBatch()` - No tests for duplicate detection, hash validation, or team warnings
- `applySyncChangeSetsToEventDb()` - No tests for transaction rollback or notification publishing
- `authenticateSyncClient()` - No tests for token validation or client expiration
- Display sync SSE streaming - No tests for connection handling or event publishing

**Impact:** High risk of regressions in production sync behavior.

**Recommendation:** Add integration tests for:
```typescript
// Example: pushSyncBatch duplicate detection
it("returns duplicate status for identical batchId and payload", async () => {
  // Test duplicate batch submission
});

it("rejects batch with same batchId but different payload", async () => {
  // Test BATCH_HASH_MISMATCH error
});
```

---

## Important Issues

### 2. File Size Violation: `sync.event-db.ts` (1488 lines)

**File:** `/src/bun/server/api/sync/sync.event-db.ts`

Exceeds the 200-line guideline by 7x. Contains multiple responsibilities:
- Table creation functions (100+ lines)
- Inspection schedule/results handlers (200+ lines)
- Match schedule/results handlers (400+ lines)
- Team rankings/awards handlers (200+ lines)
- Notification publishing

**Recommendation:** Split into modular files:
```
src/bun/server/api/sync/
├── sync.event-db.ts              # Main export + orchestration
├── sync.event-db-inspection.ts   # Inspection tables + handlers
├── sync.event-db-match.ts        # Match schedule + results
├── sync.event-db-rankings.ts     # Team rankings + awards
└── sync.event-db-utils.ts        # Shared utilities
```

### 3. In-Memory Display Sync Hub

**File:** `/src/bun/server/api/display/display-sync.ts`

`InMemoryDisplaySyncHub` loses all state on server restart:
```typescript
private readonly latestByEventCode = new Map<string, DisplaySyncEvent>();
```

**Impact:** Clients reconnecting after restart won't receive snapshot hints until new commands are issued.

**Recommendation:** Add optional persistence layer (Redis or SQLite) for production deployments.

### 4. Potential Race Condition in `pushSyncBatch`

**File:** `/src/bun/server/api/sync/sync.service.ts:471-497`

```typescript
const existingBatch = db.select()...get();  // Line 471-480

if (existingBatch) {
  if (existingBatch.payloadHash === payloadHash) {
    return { status: "duplicate" };  // Line 484-489
  }
  throwSyncError("BATCH_HASH_MISMATCH", ...);  // Line 492-496
}
```

**Issue:** Time-of-check to time-of-use (TOCTOU) vulnerability. Two concurrent requests with the same `batchId` could both pass the check at line 471, then both insert.

**Recommendation:** Add unique constraint on `(clientId, batchId)` and handle constraint violation:
```typescript
// Add to syncBatches table schema:
uniqueIndex("idx_sync_batches_client_batch", [syncBatches.clientId, syncBatches.batchId])
```

### 5. Hardcoded Timezone in Bootstrap Response

**File:** `/src/bun/server/api/sync/sync.service.ts:371`

```typescript
timezone: "Asia/Ho_Chi_Minh",  // Hardcoded
```

**Impact:** Events in other regions will have incorrect timezone metadata.

**Recommendation:** Use event-specific timezone from NRC Web bootstrap data or make configurable.

---

## Minor Suggestions

### 6. Magic Numbers in Display SSE

**File:** `/src/bun/server/api/display/display.routes.ts`

```typescript
const SSE_RETRY_MS = 2000;
const SSE_HEARTBEAT_MS = 20_000;
```

**Suggestion:** Document rationale for these values in comments or move to config.

### 7. Inconsistent Error Response Format

**File:** `/src/bun/server/api/sync/sync.routes.ts`

Some routes return `{ error: string }` (line 75), others return `{ error: string, message: string }` (line 92-96).

**Recommendation:** Standardize error response format across all sync endpoints.

### 8. Missing Input Sanitization for `eventKey`

**File:** `/src/mainview/pages/events/sync-event-page.tsx:53`

The `eventKey` (bearer token) is passed directly to the API without trimming validation beyond `.trim()`:

```typescript
eventKey: eventKey.trim(),
```

**Recommendation:** Add minimum length validation and pattern check before submission.

---

## Test Coverage Assessment

| Component | Tests Added | Coverage |
|-----------|-------------|----------|
| Event code validation | 4 tests | Good |
| Sync service (push/auth) | 0 tests | Missing |
| Sync routes (admin API) | 0 tests | Missing |
| Display sync SSE | 0 tests | Missing |
| sync.event-db apply functions | 0 tests | Missing |
| Bootstrap from NRC Web | 0 tests | Missing |

**Overall:** ~5% of new code has test coverage.

---

## Positive Observations

1. **Strong Error Handling:** Custom `SyncError` class with status codes and structured issues
2. **Timing-Safe Comparison:** Uses `timingSafeEqual` for secret validation (security best practice)
3. **Transaction Safety:** Proper BEGIN/COMMIT/ROLLBACK in `applySyncChangeSetsToEventDb`
4. **SSE Cleanup:** Proper abort handling and resource cleanup in display routes
5. **Schema Validation:** Consistent use of valibot for request/response validation
6. **Notification Hub Pattern:** Clean separation of sync application and event publishing

---

## Recommended Actions

### Must Fix (Before Merge)
1. Add integration tests for `pushSyncBatch` duplicate/hash detection logic
2. Add unique constraint on `syncBatches(clientId, batchId)` to prevent race conditions

### Should Fix (Before Release)
3. Modularize `sync.event-db.ts` into focused files
4. Add tests for `applySyncChangeSetsToEventDb` transaction rollback
5. Fix hardcoded timezone in bootstrap response

### Nice to Have
6. Document SSE timing constants
7. Standardize error response format
8. Add persistence option for display sync hub

---

## Unresolved Questions

1. **Persistence Strategy:** Is the in-memory display sync hub intentional for ephemeral events, or should it persist across restarts?
2. **Batch Size Limits:** Should there be a maximum `recordCount` per batch to prevent memory issues?
3. **Rate Limiting:** Are there rate limits on the `/machine/push` endpoint to prevent abuse?
4. **Client Expiration:** What happens to events when a sync client expires mid-event?

---

## Metrics

- **Linting:** Pass (ultracite check - no issues)
- **Tests:** 4 pass, 0 fail (but only covers validation, not sync logic)
- **Type Coverage:** Appears complete (no explicit `any` types found)
- **File Size Violations:** 1 file (sync.event-db.ts - 1488 lines)
