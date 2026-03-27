import type {
  CreateSyncClientInput,
  CreateSyncClientResult,
  EventTeamDirectoryEntry,
  ListSyncBatchesQuery,
  PushSyncBatchRequestDto,
  PushSyncBatchResult,
  ReviewSyncBatchResult,
  StagedSyncChangeSet,
  SyncBatchDetail,
  SyncBatchListResult,
  SyncBatchReviewCandidate,
  SyncClientAuthentication,
  SyncClientItem,
  SyncPolicyItem,
  SyncPolicyState,
  SyncWarning,
  UpdateSyncPolicyInput,
} from "../dtos/sync";

export interface SyncRepository {
  applyStagedChangeSets(
    eventCode: string,
    changeSets: StagedSyncChangeSet[]
  ): void | Promise<void>;

  authenticateClient(
    secret: string
  ): SyncClientAuthentication | Promise<SyncClientAuthentication>;

  createSyncClient(
    input: CreateSyncClientInput
  ): CreateSyncClientResult | Promise<CreateSyncClientResult>;

  getEventTeamDirectory(
    eventCode: string
  ): EventTeamDirectoryEntry[] | Promise<EventTeamDirectoryEntry[]>;

  getSyncBatchDetail(
    pushBatchId: string
  ): SyncBatchDetail | null | Promise<SyncBatchDetail | null>;

  getSyncBatchReviewCandidate(
    changeSetId: string
  ): SyncBatchReviewCandidate | null | Promise<SyncBatchReviewCandidate | null>;

  getSyncPolicy(
    eventCode: string
  ): SyncPolicyState | null | Promise<SyncPolicyState | null>;

  getSyncPolicyView(
    eventCode: string
  ): SyncPolicyItem | null | Promise<SyncPolicyItem | null>;

  listSyncBatches(
    query: ListSyncBatchesQuery
  ): SyncBatchListResult | Promise<SyncBatchListResult>;

  listSyncClients(
    eventCode: string
  ): SyncClientItem[] | Promise<SyncClientItem[]>;

  pushBatch(input: {
    changeSets: StagedSyncChangeSet[];
    clientId: string;
    eventCode: string;
    payload: PushSyncBatchRequestDto;
    status: "applied" | "pending_review";
    warnings: SyncWarning[];
  }): PushSyncBatchResult | Promise<PushSyncBatchResult>;

  reviewBatch(input: {
    changeSetId: string;
    newStatus: "applied" | "rejected";
    reason?: string;
    reviewerId: string;
  }): ReviewSyncBatchResult | Promise<ReviewSyncBatchResult>;

  revokeSyncClient(clientId: string): boolean | Promise<boolean>;

  updateSyncPolicy(
    input: UpdateSyncPolicyInput
  ): SyncPolicyItem | Promise<SyncPolicyItem>;
}
