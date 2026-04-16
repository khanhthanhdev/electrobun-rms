import { and, eq, lte, or, sql } from "drizzle-orm";
import { db, schema } from "../../../db";
import type {
  MachinePushResourceType,
  PushSyncBatchRequestDto,
} from "../../application/dtos/sync";
import { machinePushResourceTypes } from "../../application/dtos/sync";
import { SyncError } from "../../application/use-cases/sync/shared";
import { buildOutboundSyncPayload } from "./outbound-sync-payload-builder";

type OutboundBatchStatus =
  | "blocked"
  | "failed"
  | "in_flight"
  | "pending_review"
  | "queued"
  | "succeeded";

const DEBOUNCE_WINDOW_MS = 1500;
const PROCESS_INTERVAL_MS = 1000;
const MAX_BACKOFF_MS = 300_000;
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const resolveAllowedResources = (input: {
  linkAllowedResources: unknown;
  policyAllowedResources: unknown;
}): MachinePushResourceType[] => {
  const full = [...machinePushResourceTypes];
  const linkAllowed = Array.isArray(input.linkAllowedResources)
    ? input.linkAllowedResources.filter(
        (value): value is MachinePushResourceType =>
          full.includes(value as MachinePushResourceType)
      )
    : full;
  const policyAllowed = Array.isArray(input.policyAllowedResources)
    ? input.policyAllowedResources.filter(
        (value): value is MachinePushResourceType =>
          full.includes(value as MachinePushResourceType)
      )
    : linkAllowed;

  const allowed = policyAllowed.filter((resource) =>
    linkAllowed.includes(resource)
  );
  return allowed.length > 0 ? allowed : full;
};

const computeBackoffMs = (attemptCount: number): number => {
  const exp = Math.min(Math.max(0, attemptCount - 1), 8);
  const base = Math.min(5000 * 2 ** exp, MAX_BACKOFF_MS);
  return base + Math.floor(Math.random() * 1500);
};

const toErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export class OutboundSyncPushService {
  private readonly debounceTimersByEventCode = new Map<string, Timer>();
  private intervalId: Timer | null = null;
  private pollInFlight = false;

  start(): void {
    if (this.intervalId) {
      return;
    }

    this.intervalId = setInterval(() => {
      this.processOneDueBatch().catch(() => undefined);
    }, PROCESS_INTERVAL_MS);
  }

  stop(): void {
    for (const timer of this.debounceTimersByEventCode.values()) {
      clearTimeout(timer);
    }
    this.debounceTimersByEventCode.clear();

    if (!this.intervalId) {
      return;
    }
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  requestEventSync(eventCode: string): void {
    const existingTimer = this.debounceTimersByEventCode.get(eventCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.enqueueSnapshotBatch(eventCode).catch(() => undefined);
      this.debounceTimersByEventCode.delete(eventCode);
    }, DEBOUNCE_WINDOW_MS);
    this.debounceTimersByEventCode.set(eventCode, timer);
  }

  async requestImmediateRetry(eventCode: string): Promise<{ batchId: string }> {
    const existingTimer = this.debounceTimersByEventCode.get(eventCode);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.debounceTimersByEventCode.delete(eventCode);
    }

    const batchId = await this.enqueueSnapshotBatch(eventCode, {
      failWhenSyncDisabled: true,
    });
    return { batchId };
  }

  getEventStatus(eventCode: string): {
    backoffUntil?: string;
    counts: Record<OutboundBatchStatus, number>;
    eventCode: string;
    hasOutboundLink: boolean;
    isSyncEnabled: boolean;
    lastAttemptAt?: string;
    lastError?: string;
    lastSuccessAt?: string;
    paused: boolean;
  } {
    const link = db
      .select()
      .from(schema.syncOutboundLinks)
      .where(eq(schema.syncOutboundLinks.eventCode, eventCode))
      .get();
    const policy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();
    const state = db
      .select()
      .from(schema.syncOutboundState)
      .where(eq(schema.syncOutboundState.eventCode, eventCode))
      .get();
    const rows = db
      .select({
        count: sql<number>`count(*)`,
        status: schema.syncOutboundBatches.status,
      })
      .from(schema.syncOutboundBatches)
      .where(eq(schema.syncOutboundBatches.eventCode, eventCode))
      .groupBy(schema.syncOutboundBatches.status)
      .all();

    const counts: Record<OutboundBatchStatus, number> = {
      blocked: 0,
      failed: 0,
      in_flight: 0,
      pending_review: 0,
      queued: 0,
      succeeded: 0,
    };
    for (const row of rows) {
      if (row.status in counts) {
        counts[row.status as OutboundBatchStatus] = Number(row.count) || 0;
      }
    }

    return {
      eventCode,
      hasOutboundLink: Boolean(link),
      isSyncEnabled: policy?.isSyncEnabled ?? false,
      paused: state?.paused ?? false,
      counts,
      backoffUntil:
        typeof state?.backoffUntil === "number"
          ? new Date(state.backoffUntil).toISOString()
          : undefined,
      lastAttemptAt:
        typeof state?.lastAttemptAt === "number"
          ? new Date(state.lastAttemptAt).toISOString()
          : undefined,
      lastError: state?.lastError ?? undefined,
      lastSuccessAt:
        typeof state?.lastSuccessAt === "number"
          ? new Date(state.lastSuccessAt).toISOString()
          : undefined,
    };
  }

  private async enqueueSnapshotBatch(
    eventCode: string,
    options: { failWhenSyncDisabled?: boolean } = {}
  ): Promise<string> {
    const link = db
      .select()
      .from(schema.syncOutboundLinks)
      .where(eq(schema.syncOutboundLinks.eventCode, eventCode))
      .get();
    if (!link) {
      throw new SyncError(
        "NO_OUTBOUND_LINK",
        404,
        `No outbound sync link configured for event "${eventCode}".`
      );
    }

    const policy = db
      .select()
      .from(schema.syncPolicies)
      .where(eq(schema.syncPolicies.eventCode, eventCode))
      .get();
    if (!policy?.isSyncEnabled) {
      await this.upsertEventState(eventCode, {
        backoffUntil: null,
        lastError: "Sync is disabled for this event.",
      });
      if (options.failWhenSyncDisabled) {
        throw new Error("Sync is disabled for this event.");
      }
      return `skipped-${Date.now()}`;
    }

    const allowedResources = resolveAllowedResources({
      linkAllowedResources: link.allowedPushResources,
      policyAllowedResources: policy.allowedPushResources,
    });
    const payload = await buildOutboundSyncPayload({
      allowedResources,
      definitionVersion: link.definitionVersion,
      eventCode,
    });

    const now = Date.now();
    db.insert(schema.syncOutboundBatches)
      .values({
        id: crypto.randomUUID(),
        eventCode,
        batchId: payload.batchId,
        payload,
        status: "queued",
        attemptCount: 0,
        nextAttemptAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    await this.upsertEventState(eventCode, {
      backoffUntil: null,
      lastError: null,
    });

    return payload.batchId;
  }

  private async processOneDueBatch(): Promise<void> {
    if (this.pollInFlight) {
      return;
    }

    this.pollInFlight = true;
    try {
      const now = Date.now();
      const dueBatch = db
        .select()
        .from(schema.syncOutboundBatches)
        .where(
          and(
            or(
              eq(schema.syncOutboundBatches.status, "queued"),
              eq(schema.syncOutboundBatches.status, "failed")
            ),
            lte(schema.syncOutboundBatches.nextAttemptAt, now)
          )
        )
        .orderBy(schema.syncOutboundBatches.nextAttemptAt)
        .limit(1)
        .get();
      if (!dueBatch) {
        return;
      }

      const state = db
        .select()
        .from(schema.syncOutboundState)
        .where(eq(schema.syncOutboundState.eventCode, dueBatch.eventCode))
        .get();
      if (state?.paused) {
        return;
      }
      if (typeof state?.backoffUntil === "number" && state.backoffUntil > now) {
        return;
      }

      db.update(schema.syncOutboundBatches)
        .set({
          status: "in_flight",
          attemptCount: (dueBatch.attemptCount ?? 0) + 1,
          lastAttemptAt: now,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.syncOutboundBatches.id, dueBatch.id),
            eq(schema.syncOutboundBatches.status, dueBatch.status)
          )
        )
        .run();

      await this.sendBatch(dueBatch.id);
    } finally {
      this.pollInFlight = false;
    }
  }

  private async validateAndGetBatchResources(batchDbId: string): Promise<
    | {
        batch: typeof schema.syncOutboundBatches.$inferSelect;
        link: typeof schema.syncOutboundLinks.$inferSelect;
        payload: PushSyncBatchRequestDto;
        now: number;
      }
    | undefined
  > {
    const now = Date.now();
    const batch = db
      .select()
      .from(schema.syncOutboundBatches)
      .where(eq(schema.syncOutboundBatches.id, batchDbId))
      .get();
    if (!batch) {
      return undefined;
    }

    const link = db
      .select()
      .from(schema.syncOutboundLinks)
      .where(eq(schema.syncOutboundLinks.eventCode, batch.eventCode))
      .get();
    if (!link) {
      await this.finalizeBatch({
        attemptAt: now,
        batch,
        errorMessage: "Outbound link no longer exists.",
        outcome: "blocked",
        responseStatus: undefined,
        retryable: false,
      });
      return undefined;
    }

    const payload = (batch.payload ?? null) as PushSyncBatchRequestDto | null;
    if (!payload) {
      await this.finalizeBatch({
        attemptAt: now,
        batch,
        errorMessage: "Batch payload is missing.",
        outcome: "blocked",
        responseStatus: undefined,
        retryable: false,
      });
      return undefined;
    }

    return { batch, link, payload, now };
  }

  private async sendBatch(batchDbId: string): Promise<void> {
    const resources = await this.validateAndGetBatchResources(batchDbId);
    if (!resources) {
      return;
    }

    const { batch, link, payload, now } = resources;

    try {
      const response = await fetch(`${link.baseUrl}/api/sync/v1/machine/push`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${link.bearerSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const textBody = await response.text();
      let parsedBody: Record<string, unknown> | null = null;
      try {
        parsedBody = textBody
          ? (JSON.parse(textBody) as Record<string, unknown>)
          : null;
      } catch {
        parsedBody = null;
      }

      const remoteStatus =
        typeof parsedBody?.status === "string" ? parsedBody.status : undefined;
      const errorCode =
        typeof parsedBody?.error === "string" ? parsedBody.error : undefined;
      const errorMessage =
        typeof parsedBody?.message === "string"
          ? parsedBody.message
          : `Remote push failed with HTTP ${response.status}.`;

      if (
        response.ok &&
        (remoteStatus === "applied" || remoteStatus === "duplicate")
      ) {
        await this.finalizeBatch({
          attemptAt: now,
          batch,
          errorMessage: null,
          outcome: "succeeded",
          responseBody: textBody || undefined,
          responseStatus: response.status,
          retryable: false,
        });
        return;
      }

      if (response.ok && remoteStatus === "pending_review") {
        await this.finalizeBatch({
          attemptAt: now,
          batch,
          errorMessage: "Remote batch is pending review.",
          outcome: "pending_review",
          responseBody: textBody || undefined,
          responseStatus: response.status,
          retryable: false,
        });
        return;
      }

      const retryable =
        RETRYABLE_HTTP_STATUSES.has(response.status) ||
        (response.status === 409 && errorCode !== "BATCH_HASH_MISMATCH");
      await this.finalizeBatch({
        attemptAt: now,
        batch,
        errorMessage,
        outcome: retryable ? "failed" : "blocked",
        responseBody: textBody || undefined,
        responseStatus: response.status,
        retryable,
      });
    } catch (error) {
      await this.finalizeBatch({
        attemptAt: now,
        batch,
        errorMessage: toErrorMessage(error),
        outcome: "failed",
        responseStatus: undefined,
        retryable: true,
      });
    }
  }

  private async finalizeBatch(input: {
    attemptAt: number;
    batch: typeof schema.syncOutboundBatches.$inferSelect;
    errorMessage: string | null;
    outcome: OutboundBatchStatus;
    responseBody?: string;
    responseStatus?: number;
    retryable: boolean;
  }): Promise<void> {
    const now = Date.now();
    const nextAttemptAt =
      input.outcome === "failed" && input.retryable
        ? now + computeBackoffMs((input.batch.attemptCount ?? 1) + 1)
        : now;

    db.insert(schema.syncOutboundAttempts)
      .values({
        outboundBatchId: input.batch.id,
        attemptedAt: input.attemptAt,
        outcome: input.outcome,
        httpStatus: input.responseStatus,
        responseBody: input.responseBody,
        errorMessage: input.errorMessage ?? undefined,
      })
      .run();

    db.update(schema.syncOutboundBatches)
      .set({
        status: input.outcome,
        nextAttemptAt,
        lastHttpStatus: input.responseStatus,
        lastError: input.errorMessage,
        updatedAt: now,
      })
      .where(eq(schema.syncOutboundBatches.id, input.batch.id))
      .run();

    await this.upsertEventState(input.batch.eventCode, {
      lastAttemptAt: input.attemptAt,
      lastSuccessAt:
        input.outcome === "succeeded" ? input.attemptAt : undefined,
      lastError: input.errorMessage,
      backoffUntil:
        input.outcome === "failed" && input.retryable ? nextAttemptAt : null,
    });
  }

  private upsertEventState(
    eventCode: string,
    patch: {
      backoffUntil?: number | null;
      lastAttemptAt?: number | null;
      lastError?: string | null;
      lastSuccessAt?: number | null;
    }
  ): void {
    const now = Date.now();
    const current = db
      .select()
      .from(schema.syncOutboundState)
      .where(eq(schema.syncOutboundState.eventCode, eventCode))
      .get();
    if (!current) {
      db.insert(schema.syncOutboundState)
        .values({
          eventCode,
          paused: false,
          lastAttemptAt: patch.lastAttemptAt ?? undefined,
          lastSuccessAt: patch.lastSuccessAt ?? undefined,
          lastError: patch.lastError ?? undefined,
          backoffUntil: patch.backoffUntil ?? undefined,
          updatedAt: now,
        })
        .run();
      return;
    }

    db.update(schema.syncOutboundState)
      .set({
        lastAttemptAt:
          patch.lastAttemptAt === undefined
            ? current.lastAttemptAt
            : patch.lastAttemptAt,
        lastSuccessAt:
          patch.lastSuccessAt === undefined
            ? current.lastSuccessAt
            : patch.lastSuccessAt,
        lastError:
          patch.lastError === undefined ? current.lastError : patch.lastError,
        backoffUntil:
          patch.backoffUntil === undefined
            ? current.backoffUntil
            : patch.backoffUntil,
        updatedAt: now,
      })
      .where(eq(schema.syncOutboundState.eventCode, eventCode))
      .run();
  }
}

export const outboundSyncPushService = new OutboundSyncPushService();
