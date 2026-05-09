import { requestJson } from "@/shared/api/http-client";

interface NrcWebConfigResponse {
  baseUrl?: string;
}

interface BootstrapSyncEventPayload {
  baseUrl?: string;
  eventCode: string;
  eventKey: string;
}

interface BootstrapSyncEventResponse {
  eventCode: string;
  redirectUrl: string;
  success: boolean;
}

interface OutboundSyncStatusResponse {
  backoffUntil?: string;
  counts: {
    blocked: number;
    failed: number;
    in_flight: number;
    pending_review: number;
    queued: number;
    succeeded: number;
  };
  eventCode: string;
  hasOutboundLink: boolean;
  isSyncEnabled: boolean;
  lastAttemptAt?: string;
  lastError?: string;
  lastSuccessAt?: string;
  paused: boolean;
}

interface RetryOutboundSyncResponse {
  batchId: string;
  eventCode: string;
  success: boolean;
}

export type {
  BootstrapSyncEventPayload,
  BootstrapSyncEventResponse,
  NrcWebConfigResponse,
  OutboundSyncStatusResponse,
  RetryOutboundSyncResponse,
};

export const fetchNrcWebBaseUrl = async (
  token: string
): Promise<NrcWebConfigResponse> =>
  requestJson<NrcWebConfigResponse>("/sync/config/nrc-web-base-url", {
    token,
  });

export const bootstrapSyncEvent = async (
  payload: BootstrapSyncEventPayload,
  token: string
): Promise<BootstrapSyncEventResponse> =>
  requestJson<BootstrapSyncEventResponse>("/sync/bootstrap-event", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    token,
  });

export const fetchOutboundSyncStatus = async (
  eventCode: string,
  token: string
): Promise<OutboundSyncStatusResponse> =>
  requestJson<OutboundSyncStatusResponse>(
    `/sync/admin/seasons/2026/events/${eventCode}/outbound-status`,
    {
      token,
    }
  );

export const retryOutboundSync = async (
  eventCode: string,
  token: string
): Promise<RetryOutboundSyncResponse> =>
  requestJson<RetryOutboundSyncResponse>(
    `/sync/admin/seasons/2026/events/${eventCode}/outbound-retry`,
    {
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      token,
    }
  );
