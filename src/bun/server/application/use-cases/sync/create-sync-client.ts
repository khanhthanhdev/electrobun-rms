import type {
  CreateSyncClientInput,
  CreateSyncClientResult,
} from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface CreateSyncClientCommand extends CreateSyncClientInput {}

export class CreateSyncClientUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    command: CreateSyncClientCommand
  ): Promise<CreateSyncClientResult> | CreateSyncClientResult {
    return this.syncRepository.createSyncClient(command);
  }
}
