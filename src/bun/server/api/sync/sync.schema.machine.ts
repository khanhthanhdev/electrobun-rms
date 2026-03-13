import {
  array,
  boolean,
  type InferOutput,
  literal,
  minLength,
  object,
  optional,
  picklist,
  pipe,
  string,
  union,
} from "valibot";
import {
  inspectionResultsRecordSchema,
  inspectionScheduleRecordSchema,
  matchResultsRecordSchema,
  matchScheduleRecordSchema,
  teamAwardsRecordSchema,
  teamRankingsRecordSchema,
} from "./sync.schema.records";

// Version Literals
export const SYNC_SCHEMA_VERSION = "2026-03-08" as const;
export const SYNC_DEFINITION_VERSION = "2025.1" as const;
export const SYNC_SEASON = "2025" as const;

export const schemaVersionLiteral = literal(SYNC_SCHEMA_VERSION);
export const definitionVersionLiteral = literal(SYNC_DEFINITION_VERSION);

// Resource Type Lists
export const machinePushResourceTypes = [
  "inspection_schedule",
  "inspection_results",
  "match_schedule",
  "match_results",
  "team_rankings",
  "team_awards",
] as const;

export const machinePullResourceTypes = [
  "season_definition",
  "event_manifest",
  "approved_registrations",
  "team_operational_profiles",
  "sync_policy",
] as const;

export const DEFAULT_ALLOWED_PUSH_RESOURCES = [...machinePushResourceTypes];
export const DEFAULT_ALLOWED_PULL_RESOURCES = [...machinePullResourceTypes];

export type MachinePushResourceType = (typeof machinePushResourceTypes)[number];
export type MachinePullResourceType = (typeof machinePullResourceTypes)[number];

// Machine API: Push Resource Envelope
export const pushResourceSchema = object({
  resourceType: picklist(machinePushResourceTypes),
  schemaRef: optional(string()),
  mode: picklist(["upsert", "replace_snapshot"]),
  records: array(
    union([
      inspectionScheduleRecordSchema,
      inspectionResultsRecordSchema,
      matchScheduleRecordSchema,
      matchResultsRecordSchema,
      teamRankingsRecordSchema,
      teamAwardsRecordSchema,
    ])
  ),
});

// Machine API: Push Request
export const pushSyncBatchRequestSchema = object({
  schemaVersion: schemaVersionLiteral,
  definitionVersion: definitionVersionLiteral,
  batchId: string(),
  producedAt: string(),
  source: optional(
    object({
      appVersion: string(),
      deviceId: optional(string()),
      databaseId: optional(string()),
    })
  ),
  resources: pipe(array(pushResourceSchema), minLength(1)),
});

// Machine API: Push Response
export const pushSyncBatchResponseSchema = object({
  batchId: string(),
  status: picklist([
    "validated",
    "applied",
    "pending_review",
    "duplicate",
    "rejected",
    "failed",
  ]),
  changeSetId: optional(string()),
  receivedAt: string(),
  warnings: optional(
    array(
      object({
        code: string(),
        message: string(),
        resourceType: optional(picklist(machinePushResourceTypes)),
        recordKey: optional(string()),
      })
    )
  ),
});

// Bootstrap Response Schemas
export const seasonDefinitionSchema = object({
  schemaVersion: string(),
  season: string(),
  definitionVersion: string(),
  gameCode: string(),
  gameName: string(),
  matchResultDetailsVersion: string(),
  rankingDetailsVersion: string(),
  publicViews: object({}),
  diffLabels: object({}),
  generatedAt: string(),
});

export const eventManifestSchema = object({
  season: string(),
  eventCode: string(),
  eventKey: string(),
  canonicalPath: string(),
  name: string(),
  venue: optional(string()),
  timezone: optional(string()),
  startsAt: string(),
  endsAt: string(),
  definitionVersion: string(),
  scheduleOwner: picklist(["WEB", "LOCAL_APP"]),
  syncReviewMode: picklist(["AUTO_ACCEPT", "MANUAL_REVIEW"]),
  isSyncEnabled: boolean(),
});

export const approvedRegistrationSchema = object({
  registrationId: string(),
  teamId: string(),
  teamNumber: string(),
  teamName: string(),
  organizationName: string(),
  status: string(),
  mentorContacts: optional(array(string())),
  operationalNotes: optional(string()),
});

export const teamOperationalProfileSchema = object({
  teamId: string(),
  teamNumber: string(),
  teamName: string(),
  pitLabel: optional(string()),
  contactSummary: optional(string()),
  specialRequirements: optional(string()),
});

export const syncPolicySchema = object({
  eventKey: string(),
  reviewMode: picklist(["AUTO_ACCEPT", "MANUAL_REVIEW"]),
  scheduleOwner: picklist(["WEB", "LOCAL_APP"]),
  allowedPushResources: array(picklist(machinePushResourceTypes)),
  allowedPullResources: array(picklist(machinePullResourceTypes)),
  updatedAt: string(),
});

export const eventBootstrapResponseSchema = object({
  schemaVersion: string(),
  generatedAt: string(),
  resources: object({
    seasonDefinition: seasonDefinitionSchema,
    eventManifest: eventManifestSchema,
    approvedRegistrations: array(approvedRegistrationSchema),
    teamOperationalProfiles: array(teamOperationalProfileSchema),
    syncPolicy: syncPolicySchema,
  }),
});

// Admin API: Sync Client Schemas
export const syncClientSchema = object({
  id: string(),
  eventKey: string(),
  name: string(),
  isActive: boolean(),
  isRevoked: boolean(),
  createdAt: string(),
  expiresAt: optional(string()),
  lastUsedAt: optional(string()),
  allowedResources: array(picklist(machinePushResourceTypes)),
});

export const createSyncClientRequestSchema = object({
  season: string(),
  eventCode: string(),
  name: string(),
  expiresAt: optional(string()),
  allowedResources: optional(array(picklist(machinePushResourceTypes))),
});

export const createSyncClientResponseSchema = object({
  client: syncClientSchema,
  secret: string(),
  warning: string(),
});

export const revokeSyncClientRequestSchema = object({
  clientId: string(),
});

// Admin API: Policy Schemas
export const syncPolicyResponseSchema = object({
  eventKey: string(),
  isSyncEnabled: boolean(),
  reviewMode: picklist(["AUTO_ACCEPT", "MANUAL_REVIEW"]),
  scheduleOwner: picklist(["WEB", "LOCAL_APP"]),
  allowedPushResources: array(picklist(machinePushResourceTypes)),
  updatedAt: string(),
});

export const updateSyncPolicyRequestSchema = object({
  season: string(),
  eventCode: string(),
  isSyncEnabled: optional(boolean()),
  reviewMode: optional(picklist(["AUTO_ACCEPT", "MANUAL_REVIEW"])),
  scheduleOwner: optional(picklist(["WEB", "LOCAL_APP"])),
  allowedPushResources: optional(array(picklist(machinePushResourceTypes))),
});

// Admin API: Batch Schemas
export const syncBatchSummarySchema = object({
  pushBatchId: string(),
  changeSetId: optional(string()),
  batchId: string(),
  status: string(),
  resourceCount: string(),
  createdAt: string(),
  reviewedAt: optional(string()),
  reviewerId: optional(string()),
});

export const getSyncBatchResponseSchema = object({
  pushBatchId: string(),
  changeSetId: optional(string()),
  batchId: string(),
  status: string(),
  eventKey: string(),
  clientId: string(),
  clientName: string(),
  createdAt: string(),
  reviewedAt: optional(string()),
  reviewerId: optional(string()),
  reviewReason: optional(string()),
  resources: array(
    object({
      resourceType: picklist(machinePushResourceTypes),
      recordCount: string(),
      mode: picklist(["upsert", "replace_snapshot"]),
    })
  ),
  warnings: array(
    object({
      code: string(),
      message: string(),
      resourceType: optional(picklist(machinePushResourceTypes)),
      recordKey: optional(string()),
    })
  ),
  diff: optional(
    object({
      added: array(object({})),
      modified: array(object({})),
      removed: array(object({})),
    })
  ),
  rawPayload: optional(object({})),
});

export const reviewSyncBatchRequestSchema = object({
  changeSetId: string(),
  decision: picklist(["APPROVE", "APPROVED", "REJECT", "REJECTED"]),
  reason: optional(string()),
});

// Type Exports
export type PushSyncBatchRequest = InferOutput<
  typeof pushSyncBatchRequestSchema
>;
export type PushSyncBatchResponse = InferOutput<
  typeof pushSyncBatchResponseSchema
>;
export type EventBootstrapResponse = InferOutput<
  typeof eventBootstrapResponseSchema
>;
export type SyncClient = InferOutput<typeof syncClientSchema>;
export type CreateSyncClientRequest = InferOutput<
  typeof createSyncClientRequestSchema
>;
export type CreateSyncClientResponse = InferOutput<
  typeof createSyncClientResponseSchema
>;
export type SyncPolicyResponse = InferOutput<typeof syncPolicyResponseSchema>;
export type UpdateSyncPolicyRequest = InferOutput<
  typeof updateSyncPolicyRequestSchema
>;
export type SyncBatchSummary = InferOutput<typeof syncBatchSummarySchema>;
export type GetSyncBatchResponse = InferOutput<
  typeof getSyncBatchResponseSchema
>;
export type ReviewSyncBatchRequest = InferOutput<
  typeof reviewSyncBatchRequestSchema
>;
