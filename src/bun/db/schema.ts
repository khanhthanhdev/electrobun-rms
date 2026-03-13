import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const ROLE_VALUES = [
  "ADMIN",
  "TSO",
  "HEAD_REFEREE",
  "REFEREE",
  "INSPECTOR",
  "LEAD_INSPECTOR",
  "JUDGE",
] as const;

export type RoleValue = (typeof ROLE_VALUES)[number];

export const events = sqliteTable("events", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  type: integer("type").notNull(),
  status: integer("status").notNull(),
  finals: integer("finals").notNull(),
  divisions: integer("divisions").notNull(),
  fields: integer("fields").notNull().default(1),
  start: integer("start").notNull(),
  end: integer("end").notNull(),
  region: text("region").notNull(),
});

export const users = sqliteTable("users", {
  username: text("username").primaryKey(),
  hashedPassword: text("hashed_password").notNull(),
  salt: text("salt"),
  type: integer("type").notNull().default(0),
  realName: text("real_name"),
  used: integer("used", { mode: "boolean" }).notNull().default(true),
  generic: integer("generic", { mode: "boolean" }).notNull().default(false),
});

export const roles = sqliteTable(
  "roles",
  {
    username: text("username").notNull(),
    role: text("role").notNull(),
    event: text("event").notNull().default("*"),
  },
  (table) => [
    primaryKey({
      columns: [table.username, table.role, table.event],
    }),
    foreignKey({
      columns: [table.username],
      foreignColumns: [users.username],
      name: "roles_user_fk",
    }).onDelete("cascade"),
    index("idx_roles_username").on(table.username),
    index("idx_roles_event").on(table.event),
    check(
      "roles_role_check",
      sql`${table.role} IN ('ADMIN', 'TSO', 'HEAD_REFEREE', 'REFEREE', 'INSPECTOR', 'LEAD_INSPECTOR', 'JUDGE')`
    ),
  ]
);

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const eventLog = sqliteTable(
  "event_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    timestamp: integer("timestamp").notNull(),
    type: text("type").notNull(),
    event: text("event"),
    info: text("info").notNull(),
    extra: text("extra").notNull(),
  },
  (table) => [
    index("idx_event_log_timestamp").on(table.timestamp),
    index("idx_event_log_event").on(table.event),
  ]
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

export type Config = typeof config.$inferSelect;
export type NewConfig = typeof config.$inferInsert;

export const accountSecrets = sqliteTable(
  "account_secrets",
  {
    username: text("username").notNull(),
    event: text("event").notNull(),
    secret: text("secret_encrypted").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.username, table.event],
    }),
    foreignKey({
      columns: [table.username],
      foreignColumns: [users.username],
      name: "account_secrets_user_fk",
    }).onDelete("cascade"),
    index("idx_account_secrets_event").on(table.event),
  ]
);

export type EventLog = typeof eventLog.$inferSelect;
export type NewEventLog = typeof eventLog.$inferInsert;

export type AccountSecret = typeof accountSecrets.$inferSelect;
export type NewAccountSecret = typeof accountSecrets.$inferInsert;

// Sync API Tables

export const syncClients = sqliteTable(
  "sync_clients",
  {
    id: text("id").primaryKey(),
    eventCode: text("event_code").notNull(),
    name: text("name").notNull(),
    secretHash: text("secret_hash").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isRevoked: integer("is_revoked", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at").notNull(),
    expiresAt: integer("expires_at"),
    lastUsedAt: integer("last_used_at"),
    allowedResources: text("allowed_resources", { mode: "json" }).$type<
      string[]
    >(),
  },
  (table) => [
    index("idx_sync_clients_event_code").on(table.eventCode),
    index("idx_sync_clients_active").on(table.isActive),
  ]
);

export const syncBatches = sqliteTable(
  "sync_batches",
  {
    id: text("id").primaryKey(),
    pushBatchId: text("push_batch_id").notNull(),
    changeSetId: text("change_set_id").unique(),
    clientId: text("client_id").notNull(),
    eventCode: text("event_code").notNull(),
    status: text("status").notNull(),
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
    index("idx_sync_batches_idempotency").on(
      table.clientId,
      table.batchId,
      table.payloadHash
    ),
  ]
);

export const syncChangeSets = sqliteTable(
  "sync_change_sets",
  {
    id: text("id").primaryKey(),
    batchId: text("batch_id").notNull(),
    resourceType: text("resource_type").notNull(),
    mode: text("mode").notNull(),
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

export const syncPolicies = sqliteTable("sync_policies", {
  eventCode: text("event_code").primaryKey(),
  isSyncEnabled: integer("is_sync_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  reviewMode: text("review_mode").notNull().default("AUTO_ACCEPT"),
  scheduleOwner: text("schedule_owner").notNull().default("WEB"),
  allowedPushResources: text("allowed_push_resources", { mode: "json" }).$type<
    string[]
  >(),
  updatedAt: integer("updated_at").notNull(),
  updatedBy: text("updated_by"),
});

export const syncOutboundLinks = sqliteTable(
  "sync_outbound_links",
  {
    eventCode: text("event_code").primaryKey(),
    baseUrl: text("base_url").notNull(),
    bearerSecret: text("bearer_secret").notNull(),
    remoteEventKey: text("remote_event_key").notNull(),
    definitionVersion: text("definition_version").notNull(),
    allowedPushResources: text("allowed_push_resources", {
      mode: "json",
    }).$type<string[]>(),
    allowedPullResources: text("allowed_pull_resources", {
      mode: "json",
    }).$type<string[]>(),
    scheduleOwner: text("schedule_owner").notNull().default("WEB"),
    reviewMode: text("review_mode").notNull().default("AUTO_ACCEPT"),
    bootstrappedAt: integer("bootstrapped_at"),
    updatedAt: integer("updated_at"),
  },
  (table) => [index("idx_sync_outbound_links_event_code").on(table.eventCode)]
);

// Sync Type Exports

export type SyncClient = typeof syncClients.$inferSelect;
export type NewSyncClient = typeof syncClients.$inferInsert;
export type SyncBatch = typeof syncBatches.$inferSelect;
export type NewSyncBatch = typeof syncBatches.$inferInsert;
export type SyncChangeSet = typeof syncChangeSets.$inferSelect;
export type NewSyncChangeSet = typeof syncChangeSets.$inferInsert;
export type SyncPolicy = typeof syncPolicies.$inferSelect;
export type NewSyncPolicy = typeof syncPolicies.$inferInsert;
export type SyncOutboundLink = typeof syncOutboundLinks.$inferSelect;
export type NewSyncOutboundLink = typeof syncOutboundLinks.$inferInsert;
