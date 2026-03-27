import type {
  EventBootstrapResponse,
  EventTeamDirectoryEntry,
} from "../../dtos/sync";
import {
  DEFAULT_ALLOWED_PULL_RESOURCES,
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  SYNC_DEFINITION_VERSION,
  SYNC_SCHEMA_VERSION,
  SYNC_SEASON,
} from "../../dtos/sync";
import type { EventRepository } from "../../interfaces/event-repository";
import type { SyncRepository } from "../../interfaces/sync-repository";
import { throwSyncError } from "./shared";

export interface GetEventBootstrapQuery {
  eventCode: string;
}

export class GetEventBootstrapUseCase {
  constructor(
    private readonly eventRepository: EventRepository,
    private readonly syncRepository: SyncRepository
  ) {}

  async execute(
    query: GetEventBootstrapQuery
  ): Promise<EventBootstrapResponse> {
    const event = await this.eventRepository.getEvent(query.eventCode);
    if (!event) {
      throwSyncError(
        "NOT_FOUND",
        404,
        `Event "${query.eventCode}" was not found.`
      );
    }
    const resolvedEvent = event as NonNullable<typeof event>;

    const policy = await this.syncRepository.getSyncPolicy(query.eventCode);
    let resolvedTeamDirectory!: EventTeamDirectoryEntry[];
    try {
      resolvedTeamDirectory = await this.syncRepository.getEventTeamDirectory(
        query.eventCode
      );
    } catch (error) {
      throwSyncError(
        "NOT_FOUND",
        404,
        error instanceof Error
          ? error.message
          : `Event "${query.eventCode}" data was not found.`
      );
    }

    const scheduleOwner =
      policy?.scheduleOwner === "LOCAL_APP" ? "LOCAL_APP" : "WEB";
    const reviewMode =
      policy?.reviewMode === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "AUTO_ACCEPT";

    return {
      generatedAt: new Date().toISOString(),
      resources: {
        approvedRegistrations: resolvedTeamDirectory.map((team) => ({
          organizationName: team.organizationName,
          registrationId: `${query.eventCode}:${team.teamNumber}`,
          status: "APPROVED",
          teamId: team.fmsTeamId,
          teamName: team.teamName,
          teamNumber: team.teamNumber,
        })),
        eventManifest: {
          canonicalPath: `/${SYNC_SEASON}/${resolvedEvent.code}`,
          definitionVersion: SYNC_DEFINITION_VERSION,
          endsAt: new Date(resolvedEvent.end).toISOString(),
          eventCode: resolvedEvent.code,
          eventKey: `${SYNC_SEASON}/${resolvedEvent.code}`,
          isSyncEnabled: policy?.isSyncEnabled ?? false,
          name: resolvedEvent.name,
          scheduleOwner,
          season: SYNC_SEASON,
          startsAt: new Date(resolvedEvent.start).toISOString(),
          syncReviewMode: reviewMode,
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
          allowedPushResources: policy?.allowedPushResources ?? [
            ...DEFAULT_ALLOWED_PUSH_RESOURCES,
          ],
          eventKey: `${SYNC_SEASON}/${resolvedEvent.code}`,
          reviewMode,
          scheduleOwner,
          updatedAt: new Date(policy?.updatedAt ?? Date.now()).toISOString(),
        },
        teamOperationalProfiles: resolvedTeamDirectory.map((team) => ({
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
}
