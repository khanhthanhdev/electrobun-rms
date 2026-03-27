import {
  ApplySyncBatchReviewUseCase,
  AuthenticateSyncClientUseCase,
  BootstrapEventFromRemoteUseCase,
  CreateSyncClientUseCase,
  GetEventBootstrapUseCase,
  GetSyncBatchDetailUseCase,
  GetSyncBatchReviewCandidateUseCase,
  GetSyncPolicyUseCase,
  GetSyncRemoteBaseUrlUseCase,
  isSyncError,
  ListSyncBatchesUseCase,
  ListSyncClientsUseCase,
  PushSyncBatchUseCase,
  RevokeSyncClientUseCase,
  SetSyncRemoteBaseUrlUseCase,
  UpdateSyncPolicyUseCase,
} from "../../application/use-cases/sync";
import { SQLiteEventRepository } from "../../infrastructure/adapters/events";
import { SQLiteSyncRepository } from "../../infrastructure/adapters/sync";
import { NrcWebSyncBootstrapService } from "../../infrastructure/services";
import { publishNotifications } from "../../infrastructure/services/sync-notification-publisher";

const syncRepository = new SQLiteSyncRepository(publishNotifications);
const eventRepository = new SQLiteEventRepository();
const syncBootstrapService = new NrcWebSyncBootstrapService();

export const authenticateSyncClientUseCase =
  new AuthenticateSyncClientUseCase(syncRepository);
export const getEventBootstrapUseCase = new GetEventBootstrapUseCase(
  eventRepository,
  syncRepository
);
export const pushSyncBatchUseCase = new PushSyncBatchUseCase(syncRepository);
export const listSyncClientsUseCase = new ListSyncClientsUseCase(
  syncRepository
);
export const createSyncClientUseCase = new CreateSyncClientUseCase(
  syncRepository
);
export const revokeSyncClientUseCase = new RevokeSyncClientUseCase(
  syncRepository
);
export const getSyncPolicyUseCase = new GetSyncPolicyUseCase(syncRepository);
export const updateSyncPolicyUseCase = new UpdateSyncPolicyUseCase(
  syncRepository
);
export const listSyncBatchesUseCase = new ListSyncBatchesUseCase(
  syncRepository
);
export const getSyncBatchDetailUseCase = new GetSyncBatchDetailUseCase(
  syncRepository
);
export const getSyncBatchReviewCandidateUseCase =
  new GetSyncBatchReviewCandidateUseCase(syncRepository);
export const applySyncBatchReviewUseCase = new ApplySyncBatchReviewUseCase(
  syncRepository
);
export const getSyncRemoteBaseUrlUseCase = new GetSyncRemoteBaseUrlUseCase(
  syncBootstrapService
);
export const setSyncRemoteBaseUrlUseCase = new SetSyncRemoteBaseUrlUseCase(
  syncBootstrapService
);
export const bootstrapEventFromRemoteUseCase =
  new BootstrapEventFromRemoteUseCase(syncBootstrapService);

export const BEARER_TOKEN_REGEX = /^Bearer\s+/i;

export const toSyncErrorResponse = (error: unknown) => {
  if (isSyncError(error)) {
    return {
      body: {
        error: error.code,
        issues: error.issues,
        message: error.message,
      },
      status: error.status,
    };
  }

  if (error instanceof Error) {
    return {
      body: {
        error: "INTERNAL_ERROR",
        message: error.message,
      },
      status: 500 as const,
    };
  }

  return {
    body: {
      error: "INTERNAL_ERROR",
      message: "Unknown sync error.",
    },
    status: 500 as const,
  };
};
