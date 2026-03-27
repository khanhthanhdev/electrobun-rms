import type { MachinePushResourceType } from "../../../application/dtos/sync";

export type MatchPhase = "PRACTICE" | "PLAYOFF" | "QUALIFICATION";
export type MatchType = "elims" | "practice" | "quals";
export type PushMode = "replace_snapshot" | "upsert";

export interface SyncRecord {
  [key: string]: unknown;
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
  records: SyncRecord[];
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
