import { requestJson } from "@/shared/api/http-client";

export interface QualificationRankingItem {
  losses: number;
  name: string;
  played: number;
  rank: number;
  rankingPoint: number;
  teamNumber: number;
  ties: number;
  total: number;
  wins: number;
}

export interface EventQualificationRankingsResponse {
  eventCode: string;
  rankings: QualificationRankingItem[];
}

export const fetchQualificationRankings = (
  eventCode: string,
  token: string | null,
  cacheBuster?: number
): Promise<EventQualificationRankingsResponse> => {
  const query =
    typeof cacheBuster === "number"
      ? `?v=${encodeURIComponent(String(cacheBuster))}`
      : "";
  return requestJson<EventQualificationRankingsResponse>(
    `/events/${encodeURIComponent(eventCode)}/qualification-rankings${query}`,
    {
      token,
    }
  );
};
