import {
  DEFAULT_ALLOWED_PUSH_RESOURCES,
  SYNC_SEASON,
  type SyncPolicyItem,
} from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface GetSyncPolicyQuery {
  eventCode: string;
}

export class GetSyncPolicyUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  async execute(query: GetSyncPolicyQuery): Promise<SyncPolicyItem> {
    const policy = await this.syncRepository.getSyncPolicyView(query.eventCode);
    if (policy) {
      return policy;
    }

    return {
      allowedPushResources: [...DEFAULT_ALLOWED_PUSH_RESOURCES],
      eventKey: `${SYNC_SEASON}/${query.eventCode}`,
      isSyncEnabled: false,
      reviewMode: "AUTO_ACCEPT",
      scheduleOwner: "WEB",
      updatedAt: new Date().toISOString(),
    };
  }
}
