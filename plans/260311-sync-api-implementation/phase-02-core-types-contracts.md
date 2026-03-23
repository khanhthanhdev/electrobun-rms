# Phase 2: Core Types & Contracts

## Overview

**Priority:** High (Required for API validation)
**Status:** Pending
**Effort:** ~45 minutes

Create Valibot schemas for all Sync API request/response contracts.

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/bun/server/api/sync/sync.schema.ts` | All Valibot schemas for API validation |

---

## Schema Definitions

### Version Literals

```typescript
import {
  array,
  boolean,
  literal,
  nullish,
  number,
  object,
  optional,
  picklist,
  string,
  union,
  type InferOutput,
} from "valibot";

export const schemaVersionLiteral = literal("2026-03-08");
export const definitionVersionLiteral = literal("2025.1");
```

### Resource Types

```typescript
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

export type MachinePushResourceType = typeof machinePushResourceTypes[number];
export type MachinePullResourceType = typeof machinePullResourceTypes[number];
```

### Record Schemas (6 types)

```typescript
// 1. Inspection Schedule
export const inspectionScheduleRecordSchema = object({
  externalInspectionItemId: optional(string()),
  teamNumber: string(),
  stationNumber: optional(string()),
  stage: string(),
  startsAt: optional(string()),
  durationMinutes: optional(number()),
  status: string(),
});

// 2. Inspection Results
export const inspectionResultsRecordSchema = object({
  teamNumber: string(),
  stage: string(),
  status: string(),
  recordedAt: string(),
  comment: optional(string()),
});

// 3. Match Schedule
export const matchScheduleRecordSchema = object({
  matchKey: string(),
  phase: picklist(["PRACTICE", "QUALIFICATION", "PLAYOFF"]),
  matchNumber: number(),
  playNumber: optional(number()),
  description: optional(string()),
  scheduledAt: optional(string()),
  status: string(),
  alliances: array(
    object({
      color: picklist(["RED", "BLUE"]),
      teamNumbers: array(string()),
    })
  ),
  externalScheduleDetailId: optional(string()),
});

// 4. Match Results
export const matchResultDetailsAllianceSchema = object({
  aSecondTierFlags: number(),
  aFirstTierFlags: number(),
  aCenterFlags: number(),
  bCenterFlagDown: number(),
  bBaseFlagsDown: number(),
  cOpponentBackfieldBullets: number(),
  dRobotParkState: number(),
  dGoldFlagsDefended: number(),
  scoreA: number(),
  scoreB: number(),
  scoreC: number(),
  scoreD: number(),
  scoreTotal: number(),
});

export const matchResultDetails2025Schema = object({
  redAlliance: matchResultDetailsAllianceSchema,
  blueAlliance: matchResultDetailsAllianceSchema,
});

export const matchResultsRecordSchema = object({
  matchKey: string(),
  phase: picklist(["PRACTICE", "QUALIFICATION", "PLAYOFF"]),
  status: string(),
  playedAt: optional(string()),
  redScore: number(),
  blueScore: number(),
  redPenalty: optional(number()),
  bluePenalty: optional(number()),
  winnerAlliance: optional(picklist(["RED", "BLUE", "TIE"])),
  alliances: array(
    object({
      color: picklist(["RED", "BLUE"]),
      teamNumbers: array(string()),
    })
  ),
  cards: optional(array(string())),
  disqualifications: optional(array(string())),
  noShows: optional(array(string())),
  externalMatchId: optional(string()),
  details: optional(matchResultDetails2025Schema),
});

// 5. Team Rankings
export const teamRankingsRecordSchema = object({
  teamNumber: string(),
  rank: number(),
  rankChange: optional(number()),
  wins: number(),
  losses: number(),
  ties: number(),
  matchesPlayed: number(),
  qualifyingScore: optional(number()),
  pointsScoredTotal: optional(number()),
  pointsScoredAverage: optional(number()),
  sortOrders: optional(array(number())),
  details: optional(object({}, nullish)),
  modifiedAt: optional(string()),
});

// 6. Team Awards
export const teamAwardsRecordSchema = object({
  awardCode: string(),
  awardName: string(),
  displayOrder: optional(number()),
  teamNumber: optional(string()),
  recipient: optional(string()),
  isPublic: boolean(),
  comment: optional(string()),
  assignedAt: optional(string()),
});
```

### Machine API Schemas

```typescript
// Push Resource Envelope
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

// Push Request
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
  resources: array(pushResourceSchema),
});

// Push Response
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
```

### Bootstrap Response Schemas

```typescript
export const seasonDefinitionSchema = object({
  schemaVersion: string(),
  season: string(),
  definitionVersion: string(),
  gameCode: string(),
  gameName: string(),
  matchResultDetailsVersion: string(),
  rankingDetailsVersion: string(),
  publicViews: object({}, nullish),
  diffLabels: object({}, nullish),
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
```

### Admin API Schemas

```typescript
// Sync Client
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

// Policy
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

// Batches
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
      added: array(object({}, nullish)),
      modified: array(object({}, nullish)),
      removed: array(object({}, nullish)),
    })
  ),
  rawPayload: optional(object({}, nullish)),
});

export const reviewSyncBatchRequestSchema = object({
  changeSetId: string(),
  decision: picklist(["APPROVE", "APPROVED", "REJECT", "REJECTED"]),
  reason: optional(string()),
});
```

### Type Exports

```typescript
export type PushSyncBatchRequest = InferOutput<typeof pushSyncBatchRequestSchema>;
export type PushSyncBatchResponse = InferOutput<typeof pushSyncBatchResponseSchema>;
export type EventBootstrapResponse = InferOutput<typeof eventBootstrapResponseSchema>;
export type SyncClient = InferOutput<typeof syncClientSchema>;
export type CreateSyncClientRequest = InferOutput<typeof createSyncClientRequestSchema>;
export type CreateSyncClientResponse = InferOutput<typeof createSyncClientResponseSchema>;
export type SyncPolicyResponse = InferOutput<typeof syncPolicyResponseSchema>;
export type UpdateSyncPolicyRequest = InferOutput<typeof updateSyncPolicyRequestSchema>;
export type SyncBatchSummary = InferOutput<typeof syncBatchSummarySchema>;
export type GetSyncBatchResponse = InferOutput<typeof getSyncBatchResponseSchema>;
export type ReviewSyncBatchRequest = InferOutput<typeof reviewSyncBatchRequestSchema>;
```

---

## Implementation Steps

1. Create `src/bun/server/api/sync/` directory
2. Create `sync.schema.ts` with all schemas above
3. Run `bun run typecheck` to verify

---

## Success Criteria

- [ ] All schemas defined and exported
- [ ] Type exports for all schema outputs
- [ ] TypeScript compiles without errors
- [ ] File under 200 lines (split into `sync.schema.records.ts`, `sync.schema.machine.ts`, `sync.schema.admin.ts` if needed)

---

## Dependencies

- Phase 1: Database Schema (for type reference)

---

## Next Phase

→ Phase 3: Machine API - Bootstrap Endpoint
