import { requestJson } from "../../../shared/api/http-client";
import type {
  InspectionDetailResponse,
  InspectionHistoryResponse,
  InspectionTeamsResponse,
} from "../../../shared/types/inspection";

export const fetchInspectionTeams = (
  eventCode: string,
  token: string,
  search: string
): Promise<InspectionTeamsResponse> => {
  const normalizedSearch = search.trim();
  const query = normalizedSearch
    ? `?search=${encodeURIComponent(normalizedSearch)}`
    : "";
  return requestJson<InspectionTeamsResponse>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams${query}`,
    { token }
  );
};

export const fetchInspectionDetail = (
  eventCode: string,
  teamNumber: number,
  token: string
): Promise<InspectionDetailResponse> =>
  requestJson<InspectionDetailResponse>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams/${encodeURIComponent(String(teamNumber))}`,
    { token }
  );

export const patchInspectionItems = (
  eventCode: string,
  teamNumber: number,
  items: Array<{ key: string; value: string | null }>,
  token: string
): Promise<InspectionDetailResponse> =>
  requestJson<InspectionDetailResponse>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams/${encodeURIComponent(String(teamNumber))}/items`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
      token,
    }
  );

export const patchInspectionStatus = (
  eventCode: string,
  teamNumber: number,
  status: string,
  token: string
): Promise<InspectionDetailResponse> =>
  requestJson<InspectionDetailResponse>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams/${encodeURIComponent(String(teamNumber))}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
      token,
    }
  );

export const postInspectionComment = (
  eventCode: string,
  teamNumber: number,
  comment: string,
  token: string
): Promise<{ success: boolean }> =>
  requestJson<{ success: boolean }>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams/${encodeURIComponent(String(teamNumber))}/comment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
      token,
    }
  );

export const fetchInspectionHistory = (
  eventCode: string,
  teamNumber: number,
  token: string
): Promise<InspectionHistoryResponse> =>
  requestJson<InspectionHistoryResponse>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams/${encodeURIComponent(String(teamNumber))}/history`,
    { token }
  );

export const postInspectionOverride = (
  eventCode: string,
  teamNumber: number,
  comment: string,
  token: string
): Promise<InspectionDetailResponse> =>
  requestJson<InspectionDetailResponse>(
    `/events/${encodeURIComponent(eventCode)}/inspection/teams/${encodeURIComponent(String(teamNumber))}/override`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
      token,
    }
  );
