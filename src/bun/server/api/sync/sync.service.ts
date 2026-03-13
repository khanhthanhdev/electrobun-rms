import { and, eq } from "drizzle-orm";
import { db, schema } from "../../../db";
import {
  applySyncChangeSetsToEventDb,
  loadEventTeamDirectory,
  type StagedSyncChangeSet,
} from "./sync.event-db";
import {
  DEFAULT_ALLOWED_PULL_RESOURCES,
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  type EventBootstrapResponse,
  type MachinePushResourceType,
  type PushSyncBatchRequest,
  SYNC_DEFINITION_VERSION,
  SYNC_SCHEMA_VERSION,
  SYNC_SEASON,
} from "./sync.schema";
import { calculatePayloadHash, compareSync } from "./sync.utils";

interface SyncClientAuth {
  allowedResources: MachinePushResourceType[];
  clientId: string;
  eventCode: string;
}

interface SyncWarning {
  code: string;
  message: string;
  recordKey?: string;
  resourceType?: MachinePushResourceType;
}

interface PushBatchInput {
  allowedResources: MachinePushResourceType[];
  clientId: string;
  eventCode: string;
  payload: PushSyncBatchRequest;
}

interface PushResult {
  batchId: string;
  changeSetId: string;
  status: "applied" | "duplicate" | "pending_review";
  warnings: SyncWarning[];
}

const RESOURCE_MODE_BY_TYPE: Record<
  MachinePushResourceType,
  "replace_snapshot" | "upsert"
> = {
  inspection_results: "upsert",
  inspection_schedule: "replace_snapshot",
  match_results: "upsert",
  match_schedule: "replace_snapshot",
  team_awards: "replace_snapshot",
  team_rankings: "replace_snapshot",
};

const REVIEW_WARNING_CODES = new Set(["UNKNOWN_TEAM_REFERENCE"]);

export class SyncError extends Error {
  readonly code: string;
  readonly status: 400 | 401 | 403 | 404 | 409 | 500;
  readonly issues?: unknown;

  constructor(
    code: string,
    status: 400 | 401 | 403 | 404 | 409 | 500,
    message: string,
    issues?: unknown
  ) {
    super(message);
    this.name = "SyncError";
    this.code = code;
    this.status = status;
    this.issues = issues;
  }
}

export const isSyncError = (error: unknown): error is SyncError =>
  error instanceof SyncError;

const throwSyncError = (
  code: string,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  message: string,
  issues?: unknown
): never => {
  throw new SyncError(code, status, message, issues);
};

const getRecordBusinessKey = (
  resourceType: MachinePushResourceType,
  record: Record<string, unknown>
): string => {
  if (resourceType === "inspection_schedule") {
    return String(
      record.externalInspectionItemId ?? `${record.teamNumber}_${record.stage}`
    );
  }

  if (resourceType === "inspection_results") {
    return `${record.teamNumber}_${record.stage}`;
  }

  if (resourceType === "match_schedule") {
    return String(record.externalScheduleDetailId ?? record.matchKey);
  }

  if (resourceType === "match_results") {
    return String(record.externalMatchId ?? record.matchKey);
  }

  if (resourceType === "team_rankings") {
    return String(record.teamNumber);
  }

  return String(record.awardCode);
};

const assertSchemaRef = (
  schemaRef: string | undefined,
  definitionVersion: string
): void => {
  if (!schemaRef) {
    return;
  }

  const separatorIndex = schemaRef.lastIndexOf("@");
  if (separatorIndex < 0) {
    throwSyncError(
      "VALIDATION_FAILED",
      400,
      `schemaRef "${schemaRef}" must include a version suffix.`
    );
  }

  const schemaVersion = schemaRef.slice(separatorIndex + 1);
  if (schemaVersion !== definitionVersion) {
    throwSyncError(
      "VALIDATION_FAILED",
      400,
      `schemaRef "${schemaRef}" does not match definitionVersion "${definitionVersion}".`
    );
  }
};

const assertMatchRecordShape = (
  resourceType: MachinePushResourceType,
  record: Record<string, unknown>
): void => {
  if (resourceType !== "match_schedule" && resourceType !== "match_results") {
    return;
  }

  const alliances = Array.isArray(record.alliances)
    ? (record.alliances as Array<{ color?: string; teamNumbers?: unknown[] }>)
    : [];
  const red = alliances.find((entry) => entry.color === "RED");
  const blue = alliances.find((entry) => entry.color === "BLUE");
  const redTeamNumbers = Array.isArray(red?.teamNumbers) ? red.teamNumbers : [];
  const blueTeamNumbers = Array.isArray(blue?.teamNumbers)
    ? blue.teamNumbers
    : [];

  if (!(redTeamNumbers?.length && blueTeamNumbers?.length)) {
    throwSyncError(
      "VALIDATION_FAILED",
      400,
      `${resourceType} records require one RED alliance and one BLUE alliance.`
    );
  }

  if (redTeamNumbers.length !== 1 || blueTeamNumbers.length !== 1) {
    throwSyncError(
      "VALIDATION_FAILED",
      400,
      `${resourceType} records currently support exactly one team per alliance in the local event database.`
    );
  }

  const seenTeamNumbers = new Set<string>();
  for (const teamNumber of [...redTeamNumbers, ...blueTeamNumbers]) {
    const normalizedTeamNumber = String(teamNumber);
    if (seenTeamNumbers.has(normalizedTeamNumber)) {
      throwSyncError(
        "VALIDATION_FAILED",
        400,
        `Match record ${String(record.matchKey)} contains duplicate team ${normalizedTeamNumber}.`
      );
    }
    seenTeamNumbers.add(normalizedTeamNumber);
  }

  if (
    resourceType === "match_results" &&
    record.phase !== "PRACTICE" &&
    (!record.details || typeof record.details !== "object")
  ) {
    throwSyncError(
      "VALIDATION_FAILED",
      400,
      `${String(record.phase)} match results require details for the local scoresheet view.`
    );
  }
};

const getWarningTeamNumbers = (
  resourceType: MachinePushResourceType,
  record: Record<string, unknown>
): string[] => {
  if (resourceType === "match_schedule" || resourceType === "match_results") {
    const alliances = Array.isArray(record.alliances)
      ? (record.alliances as Array<{ teamNumbers?: unknown[] }>)
      : [];

    return alliances.flatMap((alliance) =>
      Array.isArray(alliance.teamNumbers)
        ? alliance.teamNumbers.map((teamNumber) => String(teamNumber))
        : []
    );
  }

  if (
    resourceType === "inspection_schedule" ||
    resourceType === "inspection_results" ||
    resourceType === "team_rankings"
  ) {
    return [String(record.teamNumber)];
  }

  if (resourceType === "team_awards" && typeof record.teamNumber === "string") {
    return [record.teamNumber];
  }

  return [];
};

const collectTeamWarnings = (
  eventCode: string,
  resourceType: MachinePushResourceType,
  record: Record<string, unknown>,
  registeredTeams: Set<string>
): SyncWarning[] => {
  const warnings: SyncWarning[] = [];
  for (const teamNumber of getWarningTeamNumbers(resourceType, record)) {
    if (registeredTeams.has(teamNumber)) {
      continue;
    }

    warnings.push({
      code: "UNKNOWN_TEAM_REFERENCE",
      message: `Team ${teamNumber} is not registered for event ${eventCode}.`,
      recordKey: getRecordBusinessKey(resourceType, record),
      resourceType,
    });
  }

  return warnings;
};

const createStagedChangeSets = (
  payload: PushSyncBatchRequest
): StagedSyncChangeSet[] =>
  payload.resources.map((resource) => ({
    mode: resource.mode,
    records: resource.records as Record<string, unknown>[],
    resourceType: resource.resourceType,
  }));

const loadTeamDirectoryOrThrow = (
  eventCode: string
): ReturnType<typeof loadEventTeamDirectory> => {
  try {
    return loadEventTeamDirectory(eventCode);
  } catch (error) {
    throw new SyncError(
      "NOT_FOUND",
      404,
      error instanceof Error
        ? error.message
        : `Event "${eventCode}" data was not found.`
    );
  }
};

export function authenticateSyncClient(bearerToken: string): SyncClientAuth {
  const clients = db.select().from(schema.syncClients).all();
  const matchingClient = clients.find((client) =>
    compareSync(bearerToken, client.secretHash)
  );

  if (!matchingClient) {
    throwSyncError("UNAUTHORIZED", 401, "Invalid sync client credentials.");
  }

  const client = matchingClient;

  if (!client?.isActive || client?.isRevoked) {
    throwSyncError("CLIENT_REVOKED", 403, "Sync client is revoked.");
  }

  if (client?.expiresAt && Date.now() > client.expiresAt) {
    throwSyncError("CLIENT_EXPIRED", 403, "Sync client is expired.");
  }

  db.update(schema.syncClients)
    .set({ lastUsedAt: Date.now() })
    .where(eq(schema.syncClients.id, client?.id ?? ""))
    .run();

  return {
    allowedResources: (client?.allowedResources as
      | MachinePushResourceType[]
      | undefined) ?? [...DEFAULT_ALLOWED_PUSH_RESOURCES],
    clientId: client?.id ?? "",
    eventCode: client?.eventCode ?? "",
  };
}

export function getSyncPolicy(eventCode: string) {
  return db
    .select()
    .from(schema.syncPolicies)
    .where(eq(schema.syncPolicies.eventCode, eventCode))
    .get();
}

export function getEventBootstrap(eventCode: string): EventBootstrapResponse {
  const event = db
    .select()
    .from(schema.events)
    .where(eq(schema.events.code, eventCode))
    .get();

  if (!event) {
    throwSyncError("NOT_FOUND", 404, `Event "${eventCode}" was not found.`);
  }

  const resolvedEvent = event;
  const policy = getSyncPolicy(eventCode);
  const teamDirectory = loadTeamDirectoryOrThrow(eventCode);
  const scheduleOwner =
    policy?.scheduleOwner === "LOCAL_APP" ? "LOCAL_APP" : "WEB";
  const reviewMode =
    policy?.reviewMode === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "AUTO_ACCEPT";

  return {
    generatedAt: new Date().toISOString(),
    resources: {
      approvedRegistrations: teamDirectory.map((team) => ({
        organizationName: team.organizationName,
        registrationId: `${eventCode}:${team.teamNumber}`,
        status: "APPROVED",
        teamId: team.fmsTeamId,
        teamName: team.teamName,
        teamNumber: team.teamNumber,
      })),
      eventManifest: {
        canonicalPath: `/${SYNC_SEASON}/${resolvedEvent?.code ?? ""}`,
        definitionVersion: SYNC_DEFINITION_VERSION,
        endsAt: new Date(resolvedEvent?.end ?? 0).toISOString(),
        eventCode: resolvedEvent?.code ?? "",
        eventKey: `${SYNC_SEASON}/${resolvedEvent?.code ?? ""}`,
        isSyncEnabled: policy?.isSyncEnabled ?? false,
        name: resolvedEvent?.name ?? "",
        scheduleOwner,
        season: SYNC_SEASON,
        startsAt: new Date(resolvedEvent?.start ?? 0).toISOString(),
        syncReviewMode: reviewMode,
        timezone: "Asia/Ho_Chi_Minh",
        venue: undefined,
      },
      seasonDefinition: {
        definitionVersion: SYNC_DEFINITION_VERSION,
        diffLabels: {},
        gameCode: "nrc-2025",
        gameName: "NRC 2025",
        generatedAt: new Date().toISOString(),
        matchResultDetailsVersion: SYNC_DEFINITION_VERSION,
        publicViews: {},
        rankingDetailsVersion: SYNC_DEFINITION_VERSION,
        schemaVersion: SYNC_SCHEMA_VERSION,
        season: SYNC_SEASON,
      },
      syncPolicy: {
        allowedPullResources: [...DEFAULT_ALLOWED_PULL_RESOURCES],
        allowedPushResources: (policy?.allowedPushResources as
          | MachinePushResourceType[]
          | undefined) ?? [...DEFAULT_ALLOWED_PUSH_RESOURCES],
        eventKey: `${SYNC_SEASON}/${resolvedEvent?.code ?? ""}`,
        reviewMode,
        scheduleOwner,
        updatedAt: new Date(policy?.updatedAt ?? Date.now()).toISOString(),
      },
      teamOperationalProfiles: teamDirectory.map((team) => ({
        contactSummary: undefined,
        pitLabel: undefined,
        specialRequirements: undefined,
        teamId: team.fmsTeamId,
        teamName: team.teamName,
        teamNumber: team.teamNumber,
      })),
    },
    schemaVersion: SYNC_SCHEMA_VERSION,
  };
}

export const applySyncBatch = (batchDbId: string): void => {
  const batch = db
    .select()
    .from(schema.syncBatches)
    .where(eq(schema.syncBatches.id, batchDbId))
    .get();

  if (!batch) {
    throwSyncError("NOT_FOUND", 404, `Batch "${batchDbId}" was not found.`);
  }

  const resolvedBatch = batch;
  const changeSets = db
    .select()
    .from(schema.syncChangeSets)
    .where(eq(schema.syncChangeSets.batchId, batchDbId))
    .all();

  const stagedChangeSets: StagedSyncChangeSet[] = changeSets.map(
    (changeSet) => ({
      mode: changeSet.mode as "replace_snapshot" | "upsert",
      records: Array.isArray(changeSet.stagedData)
        ? (changeSet.stagedData as Record<string, unknown>[])
        : [],
      resourceType: changeSet.resourceType as MachinePushResourceType,
    })
  );

  applySyncChangeSetsToEventDb(
    resolvedBatch?.eventCode ?? "",
    stagedChangeSets
  );

  for (const changeSet of changeSets) {
    db.update(schema.syncChangeSets)
      .set({
        appliedData: changeSet.stagedData,
      })
      .where(eq(schema.syncChangeSets.id, changeSet.id))
      .run();
  }
};

export function pushSyncBatch(input: PushBatchInput): PushResult {
  const { allowedResources, clientId, eventCode, payload } = input;
  const policy = getSyncPolicy(eventCode);

  if (!policy?.isSyncEnabled) {
    throwSyncError("SYNC_DISABLED", 403, "Sync is disabled for this event.");
  }

  const syncPolicy = policy;

  if (payload.definitionVersion !== SYNC_DEFINITION_VERSION) {
    throwSyncError(
      "UNSUPPORTED_DEFINITION_VERSION",
      400,
      `Unsupported definitionVersion "${payload.definitionVersion}".`
    );
  }

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
        changeSetId: existingBatch.changeSetId ?? existingBatch.id,
        status: "duplicate",
        warnings: [],
      };
    }

    throwSyncError(
      "BATCH_HASH_MISMATCH",
      409,
      `Batch "${payload.batchId}" was already submitted with a different payload.`
    );
  }

  const registeredTeams = new Set(
    loadTeamDirectoryOrThrow(eventCode).map((team) => team.teamNumber)
  );
  const warnings: SyncWarning[] = [];

  for (const resource of payload.resources) {
    assertSchemaRef(resource.schemaRef, payload.definitionVersion);

    if (RESOURCE_MODE_BY_TYPE[resource.resourceType] !== resource.mode) {
      throwSyncError(
        "VALIDATION_FAILED",
        400,
        `${resource.resourceType} requires mode "${RESOURCE_MODE_BY_TYPE[resource.resourceType]}".`
      );
    }

    const policyAllowedResources =
      (syncPolicy?.allowedPushResources as
        | MachinePushResourceType[]
        | undefined) ?? allowedResources;
    if (
      !(
        allowedResources.includes(resource.resourceType) &&
        policyAllowedResources.includes(resource.resourceType)
      )
    ) {
      throwSyncError(
        "RESOURCE_TYPE_NOT_ALLOWED",
        403,
        `${resource.resourceType} is not allowed for this sync client.`
      );
    }

    const keys = new Set<string>();
    for (const rawRecord of resource.records as Record<string, unknown>[]) {
      assertMatchRecordShape(resource.resourceType, rawRecord);

      const recordKey = getRecordBusinessKey(resource.resourceType, rawRecord);
      if (keys.has(recordKey)) {
        throwSyncError(
          "VALIDATION_FAILED",
          400,
          `Duplicate record key "${recordKey}" detected for ${resource.resourceType}.`
        );
      }
      keys.add(recordKey);

      warnings.push(
        ...collectTeamWarnings(
          eventCode,
          resource.resourceType,
          rawRecord,
          registeredTeams
        )
      );
    }
  }

  const batchDbId = crypto.randomUUID();
  const changeSetId = crypto.randomUUID();
  const status =
    syncPolicy?.reviewMode === "MANUAL_REVIEW" ||
    warnings.some((warning) => REVIEW_WARNING_CODES.has(warning.code))
      ? "pending_review"
      : "applied";

  db.insert(schema.syncBatches)
    .values({
      batchId: payload.batchId,
      changeSetId,
      clientId,
      createdAt: Date.now(),
      eventCode,
      id: batchDbId,
      payloadHash,
      pushBatchId: payload.batchId,
      rawPayload: payload,
      status,
      warnings,
    })
    .run();

  for (const changeSet of createStagedChangeSets(payload)) {
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

  if (status === "applied") {
    try {
      applySyncBatch(batchDbId);
    } catch (error) {
      db.update(schema.syncBatches)
        .set({ status: "failed" })
        .where(eq(schema.syncBatches.id, batchDbId))
        .run();
      throw error;
    }
  }

  return {
    batchId: payload.batchId,
    changeSetId,
    status,
    warnings,
  };
}
