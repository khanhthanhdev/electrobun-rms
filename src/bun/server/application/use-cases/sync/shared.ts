import { ApplicationError } from "../../common/application-error";
import {
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  type EventTeamDirectoryEntry,
  type MachinePushResourceType,
  type PushSyncBatchRequestDto,
  type PushSyncResource,
  type StagedSyncChangeSet,
  SYNC_DEFINITION_VERSION,
  type SyncWarning,
} from "../../dtos/sync";

export const RESOURCE_MODE_BY_TYPE: Record<
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

export const REVIEW_WARNING_CODES = new Set(["UNKNOWN_TEAM_REFERENCE"]);

export class SyncError extends ApplicationError {
  readonly code: string;
  readonly issues?: unknown;
  declare readonly status: 400 | 401 | 403 | 404 | 409 | 500;

  constructor(
    code: string,
    status: 400 | 401 | 403 | 404 | 409 | 500,
    message: string,
    issues?: unknown
  ) {
    super(message, status);
    this.code = code;
    this.issues = issues;
  }
}

export const isSyncError = (error: unknown): error is SyncError =>
  error instanceof SyncError;

export const isNotFoundError = (error: unknown): boolean => {
  if (error instanceof ApplicationError && error.status === 404) {
    return true;
  }

  return error instanceof Error && /\bnot found\b/i.test(error.message);
};

export const throwSyncError = (
  code: string,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  message: string,
  issues?: unknown
): never => {
  throw new SyncError(code, status, message, issues);
};

export const createStagedChangeSets = (
  payload: PushSyncBatchRequestDto
): StagedSyncChangeSet[] =>
  payload.resources.map((resource) => ({
    mode: resource.mode,
    records: resource.records,
    resourceType: resource.resourceType,
  }));

export const assertDefinitionVersion = (definitionVersion: string): void => {
  if (definitionVersion !== SYNC_DEFINITION_VERSION) {
    throwSyncError(
      "UNSUPPORTED_DEFINITION_VERSION",
      400,
      `Unsupported definitionVersion "${definitionVersion}".`
    );
  }
};

export const getRecordBusinessKey = (
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

export const assertSchemaRef = (
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

export const assertMatchRecordShape = (
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

  if (!(redTeamNumbers.length && blueTeamNumbers.length)) {
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

export const collectTeamWarnings = (
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

export const resolveAllowedPushResources = (
  allowedResources: MachinePushResourceType[] | undefined
): MachinePushResourceType[] =>
  allowedResources ?? [...DEFAULT_ALLOWED_PUSH_RESOURCES];

export const buildRegisteredTeamSet = (
  teamDirectory: EventTeamDirectoryEntry[]
): Set<string> => new Set(teamDirectory.map((team) => team.teamNumber));

export const validatePushResource = (input: {
  allowedClientResources: MachinePushResourceType[];
  allowedPolicyResources: MachinePushResourceType[];
  eventCode: string;
  registeredTeams: Set<string>;
  resource: PushSyncResource;
}): SyncWarning[] => {
  const warnings: SyncWarning[] = [];

  assertSchemaRef(input.resource.schemaRef, SYNC_DEFINITION_VERSION);

  if (
    RESOURCE_MODE_BY_TYPE[input.resource.resourceType] !== input.resource.mode
  ) {
    throwSyncError(
      "VALIDATION_FAILED",
      400,
      `${input.resource.resourceType} requires mode "${RESOURCE_MODE_BY_TYPE[input.resource.resourceType]}".`
    );
  }

  if (
    !(
      input.allowedClientResources.includes(input.resource.resourceType) &&
      input.allowedPolicyResources.includes(input.resource.resourceType)
    )
  ) {
    throwSyncError(
      "RESOURCE_TYPE_NOT_ALLOWED",
      403,
      `${input.resource.resourceType} is not allowed for this sync client.`
    );
  }

  const keys = new Set<string>();
  for (const record of input.resource.records) {
    assertMatchRecordShape(input.resource.resourceType, record);

    const recordKey = getRecordBusinessKey(input.resource.resourceType, record);
    if (keys.has(recordKey)) {
      throwSyncError(
        "VALIDATION_FAILED",
        400,
        `Duplicate record key "${recordKey}" detected for ${input.resource.resourceType}.`
      );
    }

    keys.add(recordKey);
    warnings.push(
      ...collectTeamWarnings(
        input.eventCode,
        input.resource.resourceType,
        record,
        input.registeredTeams
      )
    );
  }

  return warnings;
};
