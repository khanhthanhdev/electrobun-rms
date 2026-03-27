import type { SyncReviewMode, SyncScheduleOwner } from "./sync-bootstrap-dto";
import type {
  MachinePushResourceType,
  PushSyncBatchRequestDto,
  SyncWarning,
} from "./sync-machine-dto";

export interface SyncClientItem {
  allowedResources: MachinePushResourceType[];
  createdAt: string;
  eventKey: string;
  expiresAt?: string;
  id: string;
  isActive: boolean;
  isRevoked: boolean;
  lastUsedAt?: string;
  name: string;
}

export interface CreateSyncClientInput {
  allowedResources?: MachinePushResourceType[];
  eventCode: string;
  expiresAt?: string;
  name: string;
}

export interface CreateSyncClientResult {
  client: SyncClientItem;
  secret: string;
  warning: string;
}

export interface SyncPolicyState {
  allowedPushResources: MachinePushResourceType[];
  isSyncEnabled: boolean;
  reviewMode: SyncReviewMode;
  scheduleOwner: SyncScheduleOwner;
  updatedAt: number;
  updatedBy?: string;
}

export interface SyncPolicyItem {
  allowedPushResources: MachinePushResourceType[];
  eventKey: string;
  isSyncEnabled: boolean;
  reviewMode: SyncReviewMode;
  scheduleOwner: SyncScheduleOwner;
  updatedAt: string;
}

export interface UpdateSyncPolicyInput {
  allowedPushResources?: MachinePushResourceType[];
  eventCode: string;
  isSyncEnabled?: boolean;
  reviewMode?: SyncReviewMode;
  scheduleOwner?: SyncScheduleOwner;
  updatedBy: string;
}

export interface SyncBatchSummary {
  batchId: string;
  changeSetId?: string;
  createdAt: string;
  pushBatchId: string;
  resourceCount: string;
  reviewedAt?: string;
  reviewerId?: string;
  status: string;
}

export interface ListSyncBatchesQuery {
  eventCode: string;
  limit: number;
  status?: string;
}

export interface SyncBatchListResult {
  batches: SyncBatchSummary[];
  hasMore: boolean;
  nextCursor?: string;
}

export interface SyncBatchResourceSummary {
  mode: string;
  recordCount: string;
  resourceType: MachinePushResourceType;
}

export interface SyncBatchDetail {
  batchId: string;
  changeSetId?: string;
  clientId: string;
  clientName: string;
  createdAt: string;
  diff?: unknown;
  eventCode: string;
  eventKey: string;
  pushBatchId: string;
  rawPayload: PushSyncBatchRequestDto | unknown;
  resources: SyncBatchResourceSummary[];
  reviewedAt?: string;
  reviewerId?: string;
  reviewReason?: string;
  status: string;
  warnings?: SyncWarning[];
}

export interface SyncBatchReviewCandidate {
  batchDbId: string;
  changeSetId: string;
  eventCode: string;
  status: string;
}

export interface ReviewSyncBatchInput {
  changeSetId: string;
  decision: string;
  reason?: string;
  reviewerId: string;
}

export interface ReviewSyncBatchResult {
  changeSetId: string;
  newStatus: string;
  reviewedAt: string;
  success: true;
}
