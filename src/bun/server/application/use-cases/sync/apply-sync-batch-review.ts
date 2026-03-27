import type {
  ReviewSyncBatchInput,
  ReviewSyncBatchResult,
} from "../../dtos/sync";
import type { SyncRepository } from "../../interfaces/sync-repository";
import { throwSyncError } from "./shared";

export class ApplySyncBatchReviewUseCase {
  constructor(private readonly syncRepository: SyncRepository) {}

  async execute(input: ReviewSyncBatchInput): Promise<ReviewSyncBatchResult> {
    const batch = await this.syncRepository.getSyncBatchReviewCandidate(
      input.changeSetId
    );

    if (!batch) {
      throwSyncError("NOT_FOUND", 404, "Batch not found");
    }

    const reviewBatch = batch as NonNullable<typeof batch>;

    if (reviewBatch.status !== "pending_review") {
      throwSyncError("BATCH_ALREADY_REVIEWED", 409, "Batch already reviewed.");
    }

    const decision = input.decision.toUpperCase();
    return this.syncRepository.reviewBatch({
      changeSetId: input.changeSetId,
      newStatus:
        decision === "APPROVE" || decision === "APPROVED"
          ? "applied"
          : "rejected",
      reason: input.reason,
      reviewerId: input.reviewerId,
    });
  }
}
