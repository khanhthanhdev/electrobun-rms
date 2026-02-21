import { requestJson } from "../../../shared/api/http-client";
import type { EventItem } from "../../../shared/types/event";

interface DefaultAccountInfo {
  password: string;
  role: string;
  username: string;
}

interface CreateManualEventPayload {
  divisions: number;
  endDate: string;
  eventCode: string;
  eventName: string;
  eventType: number;
  finals?: number;
  region: string;
  startDate: string;
  status?: number;
}

interface CreateManualEventResponse {
  event: EventItem;
}

interface UpdateEventPayload {
  divisions: number;
  endDate: string;
  eventName: string;
  eventType: number;
  finals?: number;
  region: string;
  startDate: string;
  status?: number;
}

interface UpdateEventResponse {
  event: EventItem;
}

interface FetchEventResponse {
  event: EventItem;
}

interface DefaultAccountsResponse {
  accounts: DefaultAccountInfo[];
  eventCode: string;
}

interface RegenerateDefaultAccountsResponse {
  accounts: DefaultAccountInfo[];
  eventCode: string;
}

export type {
  CreateManualEventPayload,
  CreateManualEventResponse,
  DefaultAccountInfo,
  DefaultAccountsResponse,
  FetchEventResponse,
  RegenerateDefaultAccountsResponse,
  UpdateEventPayload,
  UpdateEventResponse,
};

export const createManualEvent = async (
  payload: CreateManualEventPayload,
  token: string
): Promise<CreateManualEventResponse> =>
  requestJson<CreateManualEventResponse>("/events/manual", {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "POST",
    token,
  });

export const fetchEvent = async (
  eventCode: string,
  token: string
): Promise<FetchEventResponse> =>
  requestJson<FetchEventResponse>(`/events/${encodeURIComponent(eventCode)}`, {
    token,
  });

export const updateEvent = async (
  eventCode: string,
  payload: UpdateEventPayload,
  token: string
): Promise<UpdateEventResponse> =>
  requestJson<UpdateEventResponse>(`/events/${encodeURIComponent(eventCode)}`, {
    body: JSON.stringify(payload),
    headers: { "Content-Type": "application/json" },
    method: "PUT",
    token,
  });

export const fetchDefaultAccounts = async (
  eventCode: string,
  token: string
): Promise<DefaultAccountsResponse> =>
  requestJson<DefaultAccountsResponse>(
    `/events/${encodeURIComponent(eventCode)}/default-accounts`,
    { token }
  );

export const regenerateDefaultAccounts = async (
  eventCode: string,
  token: string
): Promise<RegenerateDefaultAccountsResponse> =>
  requestJson<RegenerateDefaultAccountsResponse>(
    `/events/${encodeURIComponent(eventCode)}/default-accounts/regenerate`,
    {
      method: "POST",
      token,
    }
  );
