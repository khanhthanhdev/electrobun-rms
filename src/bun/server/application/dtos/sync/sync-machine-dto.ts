export const machinePushResourceTypes = [
  "inspection_schedule",
  "inspection_results",
  "match_schedule",
  "match_results",
  "team_rankings",
  "team_awards",
] as const;

export const DEFAULT_ALLOWED_PUSH_RESOURCES = [...machinePushResourceTypes];

export type MachinePushResourceType = (typeof machinePushResourceTypes)[number];
export type MatchPhase = "PRACTICE" | "PLAYOFF" | "QUALIFICATION";
export type MatchType = "elims" | "practice" | "quals";
export type PushMode = "replace_snapshot" | "upsert";

export interface SyncClientAuthentication {
  allowedResources: MachinePushResourceType[];
  clientId: string;
  eventCode: string;
}

export interface SyncWarning {
  code: string;
  message: string;
  recordKey?: string;
  resourceType?: MachinePushResourceType;
}

export interface PushSyncSource {
  appVersion: string;
  databaseId?: string;
  deviceId?: string;
}

export interface PushSyncResource {
  mode: PushMode;
  records: Record<string, unknown>[];
  resourceType: MachinePushResourceType;
  schemaRef?: string;
}

export interface PushSyncBatchRequestDto {
  batchId: string;
  definitionVersion: string;
  producedAt: string;
  resources: PushSyncResource[];
  schemaVersion: string;
  source?: PushSyncSource;
}

export interface PushSyncBatchResult {
  batchId: string;
  changeSetId: string;
  status: "applied" | "duplicate" | "pending_review";
  warnings: SyncWarning[];
}

export interface EventTeamDirectoryEntry {
  city?: string;
  country?: string;
  fmsTeamId: string;
  organizationName: string;
  teamName: string;
  teamNumber: string;
}

export interface StagedSyncChangeSet {
  mode: PushMode;
  records: Record<string, unknown>[];
  resourceType: MachinePushResourceType;
}

export interface ApplyNotifications {
  inspectionTeamNumbers: Set<number>;
  rankingUpdated: boolean;
  scoringUpdates: Array<{ matchNumber: number; matchType: MatchType }>;
}

export interface MatchLineup {
  blueTeam: number;
  matchNumber: number;
  redTeam: number;
  scheduledAt: number;
  status: number;
}
