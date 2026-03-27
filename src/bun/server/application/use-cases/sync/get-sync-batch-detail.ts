import type { SyncBatchDetail } from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface GetSyncBatchDetailQuery {
  pushBatchId: string;
}

export class GetSyncBatchDetailUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    query: GetSyncBatchDetailQuery
  ): Promise<SyncBatchDetail | null> | SyncBatchDetail | null {
    return this.syncRepository.getSyncBatchDetail(query.pushBatchId);
  }
}
