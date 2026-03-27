import type { MachinePushResourceType } from "./sync-machine-dto";

export const SYNC_SCHEMA_VERSION = "2026-03-08" as const;
export const SYNC_DEFINITION_VERSION = "2025.1" as const;
export const SYNC_SEASON = "2025" as const;

export const machinePullResourceTypes = [
  "season_definition",
  "event_manifest",
  "approved_registrations",
  "team_operational_profiles",
  "sync_policy",
] as const;

export const DEFAULT_ALLOWED_PULL_RESOURCES = [...machinePullResourceTypes];

export type MachinePullResourceType = (typeof machinePullResourceTypes)[number];
export type SyncReviewMode = "AUTO_ACCEPT" | "MANUAL_REVIEW";
export type SyncScheduleOwner = "LOCAL_APP" | "WEB";

export interface SeasonDefinitionDto {
  definitionVersion: string;
  diffLabels: Record<string, string>;
  gameCode: string;
  gameName: string;
  generatedAt: string;
  matchResultDetailsVersion: string;
  publicViews: Record<string, { columns?: Record<string, unknown> }>;
  rankingDetailsVersion: string;
  schemaVersion: string;
  season: string;
}

export interface EventManifestDto {
  canonicalPath: string;
  definitionVersion: string;
  endsAt: string;
  eventCode: string;
  eventKey: string;
  isSyncEnabled: boolean;
  name: string;
  scheduleOwner: SyncScheduleOwner;
  season: string;
  startsAt: string;
  syncReviewMode: SyncReviewMode;
  timezone?: string;
  venue?: string;
}

export interface ApprovedRegistrationDto {
  mentorContacts?: string[];
  operationalNotes?: string;
  organizationName: string;
  registrationId: string;
  status: string;
  teamId: string;
  teamName: string;
  teamNumber: string;
}

export interface TeamOperationalProfileDto {
  contactSummary?: string;
  pitLabel?: string;
  specialRequirements?: string;
  teamId: string;
  teamName: string;
  teamNumber: string;
}

export interface SyncPolicyResourceDto {
  allowedPullResources: MachinePullResourceType[];
  allowedPushResources: MachinePushResourceType[];
  eventKey: string;
  reviewMode: SyncReviewMode;
  scheduleOwner: SyncScheduleOwner;
  updatedAt: string;
}

export interface EventBootstrapResponse {
  generatedAt: string;
  resources: {
    approvedRegistrations: ApprovedRegistrationDto[];
    eventManifest: EventManifestDto;
    seasonDefinition: SeasonDefinitionDto;
    syncPolicy: SyncPolicyResourceDto;
    teamOperationalProfiles: TeamOperationalProfileDto[];
  };
  schemaVersion: string;
}

export interface BootstrappedRemoteEvent {
  allowedPullResources: MachinePullResourceType[];
  allowedPushResources: MachinePushResourceType[];
  baseUrl: string;
  bearerSecret: string;
  bootstrapData: EventBootstrapResponse;
  definitionVersion: string;
  remoteEventCode: string;
  remoteEventKey: string;
  reviewMode: SyncReviewMode;
  scheduleOwner: SyncScheduleOwner;
}
