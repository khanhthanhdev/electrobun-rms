import type { SyncBatchReviewCandidate } from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";

export interface GetSyncBatchReviewCandidateQuery {
  changeSetId: string;
}

export class GetSyncBatchReviewCandidateUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  execute(
    query: GetSyncBatchReviewCandidateQuery
  ):
    | Promise<SyncBatchReviewCandidate | null>
    | SyncBatchReviewCandidate
    | null {
    return this.syncRepository.getSyncBatchReviewCandidate(query.changeSetId);
  }
}
