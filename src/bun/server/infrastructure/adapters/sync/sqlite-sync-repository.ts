import { and, eq } from "drizzle-orm";
import { db, getSqlite, schema } from "../../../../db";
import {
  type ApplyNotifications,
  type CreateSyncClientInput,
  type CreateSyncClientResult,
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  type EventTeamDirectoryEntry,
  type ListSyncBatchesQuery,
  type PushSyncBatchRequestDto,
  type PushSyncBatchResult,
  type ReviewSyncBatchResult,
  type StagedSyncChangeSet,
  SYNC_SEASON,
  type SyncBatchDetail,
  type SyncBatchListResult,
  type SyncBatchReviewCandidate,
  type SyncClientAuthentication,
  type SyncClientItem,
  type SyncPolicyItem,
  type SyncPolicyState,
  type SyncWarning,
  type UpdateSyncPolicyInput,
} from "../../../application/dtos/sync";
import type { SyncRepository } from "../../../application/interfaces/sync-repository";
import { throwSyncError } from "../../../application/use-cases/sync/shared";
import {
  calculatePayloadHash,
  generateSecret,
  hashSyncSecret,
} from "./sync-crypto";
import { applySyncChangeSetsToEventDb } from "./sync-event-db-apply-sync-change-sets";
import { loadEventTeamDirectory } from "./sync-event-db-team-directory";

const withImmediateTransaction = <T>(fn: () => T): T => {
  const sqlite = getSqlite();
  sqlite.exec("BEGIN IMMEDIATE TRANSACTION");
  try {
    const result = fn();
    sqlite.exec("COMMIT");
    return result;
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
};

const toIsoString = (value: number | null | undefined): string | undefined =>
  typeof value === "number" ? new Date(value).toISOString() : undefined;

const toSyncClientItem = (
  client: typeof schema.syncClients.$inferSelect
): SyncClientItem => ({
  allowedResources:
    (client.allowedResources as SyncClientItem["allowedResources"] | null) ??
    [],
  createdAt: new Date(client.createdAt).toISOString(),
  eventKey: `${SYNC_SEASON}/${client.eventCode}`,
  expiresAt: toIsoString(client.expiresAt),
  id: client.id,
  isActive: client.isActive,
  isRevoked: client.isRevoked,
  lastUsedAt: toIsoString(client.lastUsedAt),
  name: client.name,
});

const toSyncPolicyState = (
  policy: typeof schema.syncPolicies.$inferSelect | undefined
): SyncPolicyState | null =>
  policy
    ? {
        allowedPushResources: (policy.allowedPushResources as
          | SyncPolicyState["allowedPushResources"]
          | null) ?? [...DEFAULT_ALLOWED_PUSH_RESOURCES],
        isSyncEnabled: policy.isSyncEnabled,
        reviewMode:
          policy.reviewMode === "MANUAL_REVIEW"
            ? "MANUAL_REVIEW"
            : "AUTO_ACCEPT",
        scheduleOwner:
          policy.scheduleOwner === "LOCAL_APP" ? "LOCAL_APP" : "WEB",
        updatedAt: policy.updatedAt,
        updatedBy: policy.updatedBy ?? undefined,
      }
    : null;

const toSyncPolicyItem = (
  eventCode: string,
  policy: SyncPolicyState | null
): SyncPolicyItem => ({
  allowedPushResources: policy?.allowedPushResources ?? [
    ...DEFAULT_ALLOWED_PUSH_RESOURCES,
  ],
  eventKey: `${SYNC_SEASON}/${eventCode}`,
  isSyncEnabled: policy?.isSyncEnabled ?? false,
  reviewMode: policy?.reviewMode ?? "AUTO_ACCEPT",
  scheduleOwner: policy?.scheduleOwner ?? "WEB",
  updatedAt: new Date(policy?.updatedAt ?? Date.now()).toISOString(),
});

export class SQLiteSyncRepository implements SyncRepository {
  constructor(
    private readonly publishNotifications: (
      eventCode: string,
      notifications: ApplyNotifications
    ) => void = () => undefined
  ) {}

  authenticateClient(secret: string): SyncClientAuthentication {
    const secretHash = hashSyncSecret(secret);
    const client = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.secretHash, secretHash))
      .get();

    if (!client) {
      throwSyncError("UNAUTHORIZED", 401, "Invalid sync client credentials.");
    }
    const resolvedClient = client as NonNullable<typeof client>;

    if (!resolvedClient.isActive || resolvedClient.isRevoked) {
      throwSyncError("CLIENT_REVOKED", 403, "Sync client is revoked.");
    }

    if (resolvedClient.expiresAt && Date.now() > resolvedClient.expiresAt) {
      throwSyncError("CLIENT_EXPIRED", 403, "Sync client is expired.");
    }

    db.update(schema.syncClients)
      .set({ lastUsedAt: Date.now() })
      .where(eq(schema.syncClients.id, resolvedClient.id))
      .run();

    return {
      allowedResources: (resolvedClient.allowedResources as
        | SyncClientAuthentication["allowedResources"]
        | null) ?? [...DEFAULT_ALLOWED_PUSH_RESOURCES],
      clientId: resolvedClient.id,
      eventCode: resolvedClient.eventCode,
    };
  }

  getSyncPolicy(eventCode: string): SyncPolicyState | null {
    const policy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();

    return toSyncPolicyState(policy);
  }

  getSyncPolicyView(eventCode: string): SyncPolicyItem {
    return toSyncPolicyItem(eventCode, this.getSyncPolicy(eventCode));
  }

  getEventTeamDirectory(eventCode: string): EventTeamDirectoryEntry[] {
    return loadEventTeamDirectory(eventCode);
  }

  listSyncClients(eventCode: string): SyncClientItem[] {
    return db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.eventCode, eventCode))
      .all()
      .map(toSyncClientItem);
  }

  createSyncClient(input: CreateSyncClientInput): CreateSyncClientResult {
    const secret = generateSecret();
    const clientId = crypto.randomUUID();
    const now = Date.now();
    const expiresAt = input.expiresAt
      ? new Date(input.expiresAt).getTime()
      : undefined;

    db.update(schema.syncClients)
      .set({ isActive: false })
      .where(
        and(
          eq(schema.syncClients.eventCode, input.eventCode),
          eq(schema.syncClients.isActive, true)
        )
      )
      .run();

    db.insert(schema.syncClients)
      .values({
        allowedResources: input.allowedResources ?? [
          ...DEFAULT_ALLOWED_PUSH_RESOURCES,
        ],
        createdAt: now,
        eventCode: input.eventCode,
        expiresAt,
        id: clientId,
        isActive: true,
        isRevoked: false,
        name: input.name,
        secretHash: hashSyncSecret(secret),
      })
      .run();

    if (input.allowedResources) {
      const existingPolicy = db
        .select()
        .from(schema.syncPolicies)
        .where(eq(schema.syncPolicies.eventCode, input.eventCode))
        .get();

      db.insert(schema.syncPolicies)
        .values({
          allowedPushResources: input.allowedResources,
          eventCode: input.eventCode,
          isSyncEnabled: existingPolicy?.isSyncEnabled ?? false,
          reviewMode: existingPolicy?.reviewMode ?? "AUTO_ACCEPT",
          scheduleOwner: existingPolicy?.scheduleOwner ?? "WEB",
          updatedAt: now,
          updatedBy: existingPolicy?.updatedBy,
        })
        .onConflictDoUpdate({
          set: {
            allowedPushResources: input.allowedResources,
            updatedAt: now,
          },
          target: schema.syncPolicies.eventCode,
        })
        .run();
    }

    const client = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.id, clientId))
      .get();

    if (!client) {
      throwSyncError("NOT_FOUND", 404, "Client not found");
    }
    const resolvedClient = client as NonNullable<typeof client>;

    return {
      client: toSyncClientItem(resolvedClient),
      secret,
      warning: "Store this secret securely. It will not be shown again.",
    };
  }

  revokeSyncClient(clientId: string): boolean {
    const client = db
      .select()
      .from(schema.syncClients)
      .where(eq(schema.syncClients.id, clientId))
      .get();

    if (!client) {
      return false;
    }

    db.update(schema.syncClients)
      .set({ isActive: false, isRevoked: true })
      .where(eq(schema.syncClients.id, clientId))
      .run();

    return true;
  }

  updateSyncPolicy(input: UpdateSyncPolicyInput): SyncPolicyItem {
    const existingPolicy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, input.eventCode))
      .get();
    const now = Date.now();

    db.insert(schema.syncPolicies)
      .values({
        allowedPushResources: input.allowedPushResources ??
          existingPolicy?.allowedPushResources ?? [
            ...DEFAULT_ALLOWED_PUSH_RESOURCES,
          ],
        eventCode: input.eventCode,
        isSyncEnabled:
          input.isSyncEnabled ?? existingPolicy?.isSyncEnabled ?? false,
        reviewMode:
          input.reviewMode ?? existingPolicy?.reviewMode ?? "AUTO_ACCEPT",
        scheduleOwner:
          input.scheduleOwner ?? existingPolicy?.scheduleOwner ?? "WEB",
        updatedAt: now,
        updatedBy: input.updatedBy,
      })
      .onConflictDoUpdate({
        set: {
          allowedPushResources: input.allowedPushResources ??
            existingPolicy?.allowedPushResources ?? [
              ...DEFAULT_ALLOWED_PUSH_RESOURCES,
            ],
          isSyncEnabled:
            input.isSyncEnabled ?? existingPolicy?.isSyncEnabled ?? false,
          reviewMode:
            input.reviewMode ?? existingPolicy?.reviewMode ?? "AUTO_ACCEPT",
          scheduleOwner:
            input.scheduleOwner ?? existingPolicy?.scheduleOwner ?? "WEB",
          updatedAt: now,
          updatedBy: input.updatedBy,
        },
        target: schema.syncPolicies.eventCode,
      })
      .run();

    return this.getSyncPolicyView(input.eventCode);
  }

  listSyncBatches(query: ListSyncBatchesQuery): SyncBatchListResult {
    const whereConditions = query.status
      ? and(
          eq(schema.syncBatches.eventCode, query.eventCode),
          eq(schema.syncBatches.status, query.status)
        )
      : eq(schema.syncBatches.eventCode, query.eventCode);

    const batches = db
      .select()
      .from(schema.syncBatches)
      .where(whereConditions)
      .limit(query.limit)
      .all();

    return {
      batches: batches.map((batch) => ({
        batchId: batch.batchId,
        changeSetId: batch.changeSetId ?? undefined,
        createdAt: new Date(batch.createdAt).toISOString(),
        pushBatchId: batch.pushBatchId,
        resourceCount: String(
          Array.isArray(
            (batch.rawPayload as { resources?: unknown[] } | null)?.resources
          )
            ? (batch.rawPayload as { resources: unknown[] }).resources.length
            : 0
        ),
        reviewedAt: toIsoString(batch.reviewedAt),
        reviewerId: batch.reviewerId ?? undefined,
        status: batch.status,
      })),
      hasMore: batches.length === query.limit,
      nextCursor: undefined,
    };
  }

  getSyncBatchDetail(pushBatchId: string): SyncBatchDetail | null {
    const batch = db
      .select()
      .from(schema.syncBatches)
      .where(eq(schema.syncBatches.pushBatchId, pushBatchId))
      .get();

    if (!batch) {
      return null;
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

    return {
      batchId: batch.batchId,
      changeSetId: batch.changeSetId ?? undefined,
      clientId: batch.clientId,
      clientName: client?.name ?? "Unknown",
      createdAt: new Date(batch.createdAt).toISOString(),
      diff: undefined,
      eventCode: batch.eventCode,
      eventKey: `${SYNC_SEASON}/${batch.eventCode}`,
      pushBatchId: batch.pushBatchId,
      rawPayload: batch.rawPayload,
      resources: changeSets.map((changeSet) => ({
        mode: changeSet.mode,
        recordCount: String(changeSet.recordCount),
        resourceType:
          changeSet.resourceType as SyncBatchDetail["resources"][number]["resourceType"],
      })),
      reviewReason: batch.reviewReason ?? undefined,
      reviewedAt: toIsoString(batch.reviewedAt),
      reviewerId: batch.reviewerId ?? undefined,
      status: batch.status,
      warnings: (batch.warnings as SyncWarning[] | undefined) ?? undefined,
    };
  }

  getSyncBatchReviewCandidate(
    changeSetId: string
  ): SyncBatchReviewCandidate | null {
    const batch = db
      .select()
      .from(schema.syncBatches)
      .where(eq(schema.syncBatches.changeSetId, changeSetId))
      .get();

    return batch
      ? {
          batchDbId: batch.id,
          changeSetId,
          eventCode: batch.eventCode,
          status: batch.status,
        }
      : null;
  }

  applyStagedChangeSets(
    eventCode: string,
    changeSets: StagedSyncChangeSet[]
  ): void {
    const notifications = applySyncChangeSetsToEventDb(eventCode, changeSets);
    this.publishNotifications(eventCode, notifications);
  }

  pushBatch(input: {
    changeSets: StagedSyncChangeSet[];
    clientId: string;
    eventCode: string;
    payload: PushSyncBatchRequestDto;
    status: "applied" | "pending_review";
    warnings: SyncWarning[];
  }): PushSyncBatchResult {
    const payloadHash = calculatePayloadHash(input.payload);
    const batchDbId = crypto.randomUUID();
    const changeSetId = crypto.randomUUID();

    return withImmediateTransaction(() => {
      const existingBatch = db
        .select()
        .from(schema.syncBatches)
        .where(
          and(
            eq(schema.syncBatches.clientId, input.clientId),
            eq(schema.syncBatches.batchId, input.payload.batchId)
          )
        )
        .get();

      if (existingBatch) {
        if (existingBatch.payloadHash === payloadHash) {
          return {
            batchId: input.payload.batchId,
            changeSetId: existingBatch.changeSetId ?? existingBatch.id,
            status: "duplicate" as const,
            warnings: [],
          };
        }

        throwSyncError(
          "BATCH_HASH_MISMATCH",
          409,
          `Batch "${input.payload.batchId}" was already submitted with a different payload.`
        );
      }

      db.insert(schema.syncBatches)
        .values({
          batchId: input.payload.batchId,
          changeSetId,
          clientId: input.clientId,
          createdAt: Date.now(),
          eventCode: input.eventCode,
          id: batchDbId,
          payloadHash,
          pushBatchId: input.payload.batchId,
          rawPayload: input.payload,
          status: input.status,
          warnings: input.warnings,
        })
        .run();

      for (const changeSet of input.changeSets) {
        db.insert(schema.syncChangeSets)
          .values({
            appliedData: undefined,
            batchId: batchDbId,
            id: crypto.randomUUID(),
            mode: changeSet.mode,
            recordCount: changeSet.records.length,
            recordKey: changeSet.resourceType,
            resourceType: changeSet.resourceType,
            stagedData: changeSet.records,
          })
          .run();
      }

      if (input.status === "applied") {
        try {
          this.applyStoredBatch(batchDbId, input.eventCode);
        } catch (error) {
          db.update(schema.syncBatches)
            .set({ status: "failed" })
            .where(eq(schema.syncBatches.id, batchDbId))
            .run();
          throw error;
        }
      }

      return {
        batchId: input.payload.batchId,
        changeSetId,
        status: input.status,
        warnings: input.warnings,
      };
    });
  }

  reviewBatch(input: {
    changeSetId: string;
    newStatus: "applied" | "rejected";
    reason?: string;
    reviewerId: string;
  }): ReviewSyncBatchResult {
    return withImmediateTransaction(() => {
      const batch = db
        .select()
        .from(schema.syncBatches)
        .where(eq(schema.syncBatches.changeSetId, input.changeSetId))
        .get();

      if (!batch) {
        throwSyncError("NOT_FOUND", 404, "Batch not found");
      }
      const resolvedBatch = batch as NonNullable<typeof batch>;

      if (resolvedBatch.status !== "pending_review") {
        throwSyncError(
          "BATCH_ALREADY_REVIEWED",
          409,
          "Batch already reviewed."
        );
      }

      if (input.newStatus === "applied") {
        this.applyStoredBatch(resolvedBatch.id, resolvedBatch.eventCode);
      }

      const reviewedAt = Date.now();
      db.update(schema.syncBatches)
        .set({
          reviewReason: input.reason,
          reviewedAt,
          reviewerId: input.reviewerId,
          status: input.newStatus,
        })
        .where(
          and(
            eq(schema.syncBatches.changeSetId, input.changeSetId),
            eq(schema.syncBatches.status, "pending_review")
          )
        )
        .run();

      return {
        changeSetId: input.changeSetId,
        newStatus: input.newStatus,
        reviewedAt: new Date(reviewedAt).toISOString(),
        success: true,
      };
    });
  }

  private applyStoredBatch(batchDbId: string, eventCode: string): void {
    const changeSets = db
      .select()
      .from(schema.syncChangeSets)
      .where(eq(schema.syncChangeSets.batchId, batchDbId))
      .all();

    const stagedChangeSets: StagedSyncChangeSet[] = changeSets.map(
      (changeSet) => ({
        mode: changeSet.mode as StagedSyncChangeSet["mode"],
        records: Array.isArray(changeSet.stagedData)
          ? (changeSet.stagedData as Record<string, unknown>[])
          : [],
        resourceType:
          changeSet.resourceType as StagedSyncChangeSet["resourceType"],
      })
    );

    this.applyStagedChangeSets(eventCode, stagedChangeSets);

    for (const changeSet of changeSets) {
      db.update(schema.syncChangeSets)
        .set({ appliedData: changeSet.stagedData })
        .where(eq(schema.syncChangeSets.id, changeSet.id))
        .run();
    }
  }
}
