import { eq } from "drizzle-orm";
import { safeParse } from "valibot";
import { db, schema } from "../../../db";
import {
  EVENT_CODE_VALIDATION_MESSAGE,
  isValidEventCode,
  normalizeEventCode,
} from "../../api/common/patterns";
import { eventBootstrapResponseSchema } from "../../api/sync/sync.schema";
import type {
  BootstrappedRemoteEvent,
  EventBootstrapResponse,
  MachinePullResourceType,
  MachinePushResourceType,
} from "../../application/dtos/sync";
import type { SeedTeamInput } from "../../application/dtos/teams";
import type { SyncBootstrapService } from "../../application/interfaces/sync-bootstrap-service";
import { SyncError } from "../../application/use-cases/sync/shared";
import { createEventShell } from "../adapters/events/sqlite-manual-event-service";
import { SQLiteTeamRepository } from "../adapters/teams/sqlite-team-repository";

const NRC_WEB_BASE_URL_CONFIG_KEY = "nrc_web_base_url";
const DEFAULT_REGION = "NRC Web";
const TRAILING_SLASH_PATTERN = /\/+$/;
const teamRepository = new SQLiteTeamRepository();

const normalizeNrcWebBaseUrl = (baseUrl: string): string => {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    throw new SyncError(
      "VALIDATION_FAILED",
      400,
      "NRC Web base URL is required."
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new SyncError(
      "VALIDATION_FAILED",
      400,
      "NRC Web base URL must be a valid absolute URL."
    );
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new SyncError(
      "VALIDATION_FAILED",
      400,
      "NRC Web base URL must use http or https."
    );
  }

  const pathname =
    parsed.pathname === "/"
      ? ""
      : parsed.pathname.replace(TRAILING_SLASH_PATTERN, "");
  return `${parsed.origin}${pathname}`;
};

const getRemoteErrorMessage = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    return (
      body.message ??
      body.error ??
      `NRC Web returned an error (${response.status}).`
    );
  } catch {
    return `NRC Web returned an error (${response.status}).`;
  }
};

const collectBootstrapTeams = (
  bootstrapData: EventBootstrapResponse
): SeedTeamInput[] => {
  const teamsByNumber = new Map<number, SeedTeamInput>();

  for (const registration of bootstrapData.resources.approvedRegistrations) {
    const teamNumber = Number.parseInt(registration.teamNumber, 10);
    if (!Number.isInteger(teamNumber) || teamNumber <= 0) {
      throw new SyncError(
        "VALIDATION_FAILED",
        400,
        `Bootstrap team number "${registration.teamNumber}" is invalid.`
      );
    }

    teamsByNumber.set(teamNumber, {
      organizationSchool: registration.organizationName,
      teamName: registration.teamName || `Team ${teamNumber}`,
      teamNumber,
    });
  }

  for (const profile of bootstrapData.resources.teamOperationalProfiles) {
    const teamNumber = Number.parseInt(profile.teamNumber, 10);
    if (!Number.isInteger(teamNumber) || teamNumber <= 0) {
      continue;
    }

    const existing = teamsByNumber.get(teamNumber);
    teamsByNumber.set(teamNumber, {
      organizationSchool: existing?.organizationSchool,
      teamName: profile.teamName || existing?.teamName || `Team ${teamNumber}`,
      teamNumber,
    });
  }

  return Array.from(teamsByNumber.values()).sort(
    (left, right) => left.teamNumber - right.teamNumber
  );
};

export class NrcWebSyncBootstrapService implements SyncBootstrapService {
  getBaseUrl(): string | null {
    const config = db
      .select({ value: schema.config.value })
      .from(schema.config)
      .where(eq(schema.config.key, NRC_WEB_BASE_URL_CONFIG_KEY))
      .get();

    return config?.value?.trim() || null;
  }

  setBaseUrl(baseUrl: string): string {
    const normalizedBaseUrl = normalizeNrcWebBaseUrl(baseUrl);

    db.insert(schema.config)
      .values({
        key: NRC_WEB_BASE_URL_CONFIG_KEY,
        value: normalizedBaseUrl,
      })
      .onConflictDoUpdate({
        target: schema.config.key,
        set: { value: normalizedBaseUrl },
      })
      .run();

    return normalizedBaseUrl;
  }

  async bootstrapEventFromRemote(input: {
    baseUrl: string;
    eventKey: string;
  }): Promise<BootstrappedRemoteEvent> {
    const baseUrl = normalizeNrcWebBaseUrl(input.baseUrl);
    const bearerSecret = input.eventKey.trim();

    if (!bearerSecret) {
      throw new SyncError("VALIDATION_FAILED", 400, "Event key is required.");
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/sync/v1/machine/bootstrap`, {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${bearerSecret}`,
        },
        method: "GET",
      });
    } catch {
      throw new SyncError(
        "NETWORK_ERROR",
        500,
        "Unable to reach NRC Web. Check the base URL and try again."
      );
    }

    if (!response.ok) {
      const message = await getRemoteErrorMessage(response);

      if (response.status === 401) {
        throw new SyncError(
          "UNAUTHORIZED",
          401,
          message || "Invalid event key."
        );
      }

      if (response.status === 404) {
        throw new SyncError(
          "NOT_FOUND",
          404,
          message || "NRC Web bootstrap endpoint not found."
        );
      }

      throw new SyncError("REMOTE_ERROR", 500, message);
    }

    let responseBody: unknown;
    try {
      responseBody = await response.json();
    } catch {
      throw new SyncError(
        "PARSE_ERROR",
        500,
        "Failed to parse NRC Web bootstrap response."
      );
    }

    const parsed = safeParse(eventBootstrapResponseSchema, responseBody);
    if (!parsed.success) {
      throw new SyncError(
        "SCHEMA_MISMATCH",
        500,
        "NRC Web returned incompatible bootstrap data.",
        parsed.issues
      );
    }

    const bootstrapData = parsed.output as EventBootstrapResponse;

    return {
      allowedPullResources: bootstrapData.resources.syncPolicy
        .allowedPullResources as MachinePullResourceType[],
      allowedPushResources: bootstrapData.resources.syncPolicy
        .allowedPushResources as MachinePushResourceType[],
      baseUrl,
      bearerSecret,
      bootstrapData,
      definitionVersion:
        bootstrapData.resources.seasonDefinition.definitionVersion,
      remoteEventCode: bootstrapData.resources.eventManifest.eventCode,
      remoteEventKey: bootstrapData.resources.eventManifest.eventKey,
      reviewMode: bootstrapData.resources.syncPolicy.reviewMode,
      scheduleOwner: bootstrapData.resources.syncPolicy.scheduleOwner,
    };
  }

  async createLocalEventFromBootstrap(
    result: BootstrappedRemoteEvent,
    eventCode: string
  ): Promise<{ eventCode: string }> {
    const normalizedEventCode = normalizeEventCode(eventCode);
    if (!isValidEventCode(normalizedEventCode)) {
      throw new SyncError(
        "VALIDATION_FAILED",
        400,
        EVENT_CODE_VALIDATION_MESSAGE
      );
    }

    const eventManifest = result.bootstrapData.resources.eventManifest;
    const startTs = Date.parse(eventManifest.startsAt);
    const endTs = Date.parse(eventManifest.endsAt);

    if (!(Number.isFinite(startTs) && Number.isFinite(endTs))) {
      throw new SyncError(
        "VALIDATION_FAILED",
        400,
        "Bootstrap event dates are invalid."
      );
    }

    const seededTeams = collectBootstrapTeams(result.bootstrapData);
    const now = Date.now();

    await createEventShell({
      divisions: 1,
      endTs,
      eventCode: normalizedEventCode,
      eventName: eventManifest.name,
      eventType: 1,
      fields: 1,
      finals: 0,
      logExtra: {
        definitionVersion: result.definitionVersion,
        remoteEventCode: result.remoteEventCode,
        remoteEventKey: result.remoteEventKey,
        source: "NRC_WEB_SYNC",
      },
      logInfo: `Event created via NRC Web sync: ${eventManifest.name}`,
      persistWithEvent: async (tx) => {
        await tx.insert(schema.syncOutboundLinks).values({
          allowedPullResources: result.allowedPullResources,
          allowedPushResources: result.allowedPushResources,
          baseUrl: result.baseUrl,
          bearerSecret: result.bearerSecret,
          bootstrappedAt: now,
          definitionVersion: result.definitionVersion,
          eventCode: normalizedEventCode,
          remoteEventKey: result.remoteEventKey,
          reviewMode: result.reviewMode,
          scheduleOwner: result.scheduleOwner,
          updatedAt: now,
        });
      },
      region: eventManifest.venue?.trim() || DEFAULT_REGION,
      seedEventDb: async () => {
        await teamRepository.seedTeams(normalizedEventCode, seededTeams);
      },
      startTs,
      status: 1,
    });

    return { eventCode: normalizedEventCode };
  }
}
