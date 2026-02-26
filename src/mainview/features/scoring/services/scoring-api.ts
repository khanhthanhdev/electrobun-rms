import { requestJson } from "../../../shared/api/http-client";
import type {
  MatchHistoryEventItem,
  MatchResultItem,
  MatchScoresheet,
  MatchType,
} from "../../../shared/types/scoring";

export const fetchMatchResults = (
  eventCode: string,
  matchType: MatchType,
  token: string | null
): Promise<MatchResultItem[]> => {
  return requestJson<MatchResultItem[]>(
    `/events/${encodeURIComponent(eventCode)}/scoring/${matchType}/results`,
    {
      method: "GET",
      token,
    }
  );
};

export const fetchMatchHistory = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number,
  token: string | null
): Promise<MatchHistoryEventItem[]> => {
  return requestJson<MatchHistoryEventItem[]>(
    `/events/${encodeURIComponent(eventCode)}/scoring/${matchType}/${matchNumber}/history`,
    {
      method: "GET",
      token,
    }
  );
};

export const fetchMatchScoresheet = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number,
  token: string | null
): Promise<MatchScoresheet> => {
  return requestJson<MatchScoresheet>(
    `/events/${encodeURIComponent(eventCode)}/scoring/${matchType}/${matchNumber}`,
    {
      method: "GET",
      token,
    }
  );
};
