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
  defaultAccounts: DefaultAccountInfo[];
  event: EventItem;
}

interface DefaultAccountsResponse {
  accounts: DefaultAccountInfo[];
  eventCode: string;
}

export type {
  CreateManualEventPayload,
  CreateManualEventResponse,
  DefaultAccountInfo,
  DefaultAccountsResponse,
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

export const fetchDefaultAccounts = async (
  eventCode: string,
  token: string
): Promise<DefaultAccountsResponse> =>
  requestJson<DefaultAccountsResponse>(
    `/events/${encodeURIComponent(eventCode)}/default-accounts`,
    { token }
  );
