import type {
  PushSyncBatchRequestDto,
  PushSyncBatchResult,
} from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";
import {
  assertDefinitionVersion,
  buildRegisteredTeamSet,
  createStagedChangeSets,
  REVIEW_WARNING_CODES,
  throwSyncError,
  validatePushResource,
} from "./shared";

export interface PushSyncBatchCommand {
  allowedResources: PushSyncBatchRequestDto["resources"][number]["resourceType"][];
  clientId: string;
  eventCode: string;
  payload: PushSyncBatchRequestDto;
}

export class PushSyncBatchUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  async execute(command: PushSyncBatchCommand): Promise<PushSyncBatchResult> {
    const policy = await this.syncRepository.getSyncPolicy(command.eventCode);
    if (!policy?.isSyncEnabled) {
      throwSyncError("SYNC_DISABLED", 403, "Sync is disabled for this event.");
    }
    const syncPolicy = policy as NonNullable<typeof policy>;

    assertDefinitionVersion(command.payload.definitionVersion);

    const teamDirectory = await this.syncRepository.getEventTeamDirectory(
      command.eventCode
    );
    const registeredTeams = buildRegisteredTeamSet(teamDirectory);
    const warnings = command.payload.resources.flatMap((resource) =>
      validatePushResource({
        allowedClientResources: command.allowedResources,
        allowedPolicyResources: syncPolicy.allowedPushResources,
        eventCode: command.eventCode,
        registeredTeams,
        resource,
      })
    );

    const status =
      syncPolicy.reviewMode === "MANUAL_REVIEW" ||
      warnings.some((warning) => REVIEW_WARNING_CODES.has(warning.code))
        ? "pending_review"
        : "applied";

    return this.syncRepository.pushBatch({
      changeSets: createStagedChangeSets(command.payload),
      clientId: command.clientId,
      eventCode: command.eventCode,
      payload: command.payload,
      status,
      warnings,
    });
  }
}
