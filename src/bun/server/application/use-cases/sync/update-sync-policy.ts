import type { SyncPolicyItem, UpdateSyncPolicyInput } from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface UpdateSyncPolicyCommand extends UpdateSyncPolicyInput {}

export class UpdateSyncPolicyUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    command: UpdateSyncPolicyCommand
  ): Promise<SyncPolicyItem> | SyncPolicyItem {
    return this.syncRepository.updateSyncPolicy(command);
  }
}
