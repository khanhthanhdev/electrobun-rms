import type {
  ListSyncBatchesQuery,
  SyncBatchListResult,
} from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export class ListSyncBatchesUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    query: ListSyncBatchesQuery
  ): Promise<SyncBatchListResult> | SyncBatchListResult {
    return this.syncRepository.listSyncBatches(query);
  }
}
