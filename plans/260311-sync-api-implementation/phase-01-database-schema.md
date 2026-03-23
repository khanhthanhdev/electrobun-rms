# Phase 1: Database Schema for Sync API

## Overview

**Priority:** Critical (Foundation for all sync functionality)
**Status:** Pending
**Effort:** ~30 minutes

Add 4 SQLite tables to support sync operations: clients, batches, change sets, and policies.

---

## Files to Modify

| File | Action |
|------|--------|
| `src/bun/db/schema.ts` | Add 4 new table definitions + type exports |

---

## Database Schema

### 1. sync_clients

Stores machine credentials for bearer token authentication.

```typescript
export const syncClients = sqliteTable(
  "sync_clients",
  {
    id: text("id").primaryKey(),
    eventCode: text("event_code").notNull(),
    name: text("name").notNull(),
    secretHash: text("secret_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isRevoked: integer("is_revoked", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),
    lastUsedAt: integer("last_used_at"),
    allowedResources: text("allowed_resources", { mode: "json" }).$type<string[]>(),
  },
  (table) => [
    index("idx_sync_clients_event_code").on(table.eventCode),
    index("idx_sync_clients_active").on(table.isActive),
    unique("sync_clients_event_unique").on(table.eventCode, table.isActive),
  ]
);
```

### 2. sync_batches

Tracks pushed batches with idempotency and review workflow.

```typescript
export const syncBatches = sqliteTable(
  "sync_batches",
  {
    id: text("id").primaryKey(),
    pushBatchId: text("push_batch_id").notNull(),
    changeSetId: text("change_set_id").unique(),
    clientId: text("client_id").notNull(),
    eventCode: text("event_code").notNull(),
    status: text("status").notNull(), // validated, applied, pending_review, rejected, failed, duplicate
    batchId: text("batch_id").notNull(),
    payloadHash: text("payload_hash").notNull(),
    rawPayload: text("raw_payload", { mode: "json" }).$type<unknown>(),
    warnings: text("warnings", { mode: "json" }).$type<unknown[]>(),
    createdAt: integer("created_at").notNull(),
    reviewedAt: integer("reviewed_at"),
    reviewerId: text("reviewer_id"),
    reviewReason: text("review_reason"),
  },
  (table) => [
    index("idx_sync_batches_client").on(table.clientId),
    index("idx_sync_batches_event").on(table.eventCode),
    index("idx_sync_batches_status").on(table.status),
    unique("sync_batches_idempotency").on(table.clientId, table.batchId, table.payloadHash),
  ]
);
```

### 3. sync_change_sets

Individual resource changes within a batch.

```typescript
export const syncChangeSets = sqliteTable(
  "sync_change_sets",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    resourceType: text("resource_type").notNull(),
    mode: text("mode").notNull(), // upsert or replace_snapshot
    recordCount: integer("record_count").notNull(),
    recordKey: text("record_key").notNull(),
    stagedData: text("staged_data", { mode: "json" }).$type<unknown>(),
    appliedData: text("applied_data", { mode: "json" }).$type<unknown>(),
  },
  (table) => [
    index("idx_sync_change_sets_batch").on(table.batchId),
    index("idx_sync_change_sets_resource").on(table.resourceType),
  ]
);
```

### 4. sync_policies

Per-event sync configuration.

```typescript
export const syncPolicies = sqliteTable(
  "sync_policies",
  {
    eventCode: text("event_code").primaryKey(),
    isSyncEnabled: integer("is_sync_enabled", { mode: "boolean" }).notNull().default(false),
    reviewMode: text("review_mode").notNull().default("AUTO_ACCEPT"),
    scheduleOwner: text("schedule_owner").notNull().default("WEB"),
    allowedPushResources: text("allowed_push_resources", { mode: "json" }).$type<string[]>(),
    updatedAt: integer("updated_at").notNull(),
    updatedBy: text("updated_by"),
  }
);
```

### Type Exports

```typescript
export type SyncClient = typeof syncClients.$inferSelect;
export type NewSyncClient = typeof syncClients.$inferInsert;
export type SyncBatch = typeof syncBatches.$inferSelect;
export type NewSyncBatch = typeof syncBatches.$inferInsert;
export type SyncChangeSet = typeof syncChangeSets.$inferSelect;
export type NewSyncChangeSet = typeof syncChangeSets.$inferInsert;
export type SyncPolicy = typeof syncPolicies.$inferSelect;
export type NewSyncPolicy = typeof syncPolicies.$inferInsert;
```

---

## Implementation Steps

1. Open `src/bun/db/schema.ts`
2. Add 4 table definitions after existing tables
3. Add type exports at end of file
4. Run `bun run typecheck` to verify no compile errors

---

## Success Criteria

- [ ] All 4 tables added to schema.ts
- [ ] All 8 type exports added
- [ ] TypeScript compiles without errors
- [ ] Schema file under 200 lines (may need to split if large)

---

## Dependencies

- None (foundation phase)

---

## Next Phase

→ Phase 2: Core Types & Contracts (Valibot schemas)
