import {
  array,
  boolean,
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
export const SYNC_SCHEMA_VERSION = "2026-05-09" as const;
export const SYNC_DEFINITION_VERSION = "2026.1" as const;
export const SYNC_SEASON = "2026" as const;

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

const inspectionSchedulePushResourceSchema = object({
  resourceType: literal("inspection_schedule"),
  schemaRef: optional(string()),
  mode: literal("replace_snapshot"),
  records: array(inspectionScheduleRecordSchema),
});

const inspectionResultsPushResourceSchema = object({
  resourceType: literal("inspection_results"),
  schemaRef: optional(string()),
  mode: literal("upsert"),
  records: array(inspectionResultsRecordSchema),
});

const matchSchedulePushResourceSchema = object({
  resourceType: literal("match_schedule"),
  schemaRef: optional(string()),
  mode: literal("replace_snapshot"),
  records: array(matchScheduleRecordSchema),
});

const matchResultsPushResourceSchema = object({
  resourceType: literal("match_results"),
  schemaRef: optional(string()),
  mode: literal("upsert"),
  records: array(matchResultsRecordSchema),
});

const teamRankingsPushResourceSchema = object({
  resourceType: literal("team_rankings"),
  schemaRef: optional(string()),
  mode: literal("replace_snapshot"),
  records: array(teamRankingsRecordSchema),
});

const teamAwardsPushResourceSchema = object({
  resourceType: literal("team_awards"),
  schemaRef: optional(string()),
  mode: literal("replace_snapshot"),
  records: array(teamAwardsRecordSchema),
});

// Machine API: Push Resource Envelope
export const pushResourceSchema = union([
  inspectionSchedulePushResourceSchema,
  inspectionResultsPushResourceSchema,
  matchSchedulePushResourceSchema,
  matchResultsPushResourceSchema,
  teamRankingsPushResourceSchema,
  teamAwardsPushResourceSchema,
]);

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

export const createSyncClientRequestSchema = object({
  season: string(),
  eventCode: string(),
  name: string(),
  expiresAt: optional(string()),
  allowedResources: optional(array(picklist(machinePushResourceTypes))),
});

export const updateSyncPolicyRequestSchema = object({
  season: string(),
  eventCode: string(),
  isSyncEnabled: optional(boolean()),
  reviewMode: optional(picklist(["AUTO_ACCEPT", "MANUAL_REVIEW"])),
  scheduleOwner: optional(picklist(["WEB", "LOCAL_APP"])),
  allowedPushResources: optional(array(picklist(machinePushResourceTypes))),
});

export const reviewSyncBatchRequestSchema = object({
  changeSetId: string(),
  decision: picklist(["APPROVE", "APPROVED", "REJECT", "REJECTED"]),
  reason: optional(string()),
});
