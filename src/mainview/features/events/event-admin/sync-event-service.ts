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

export type {
  BootstrapSyncEventPayload,
  BootstrapSyncEventResponse,
  NrcWebConfigResponse,
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
