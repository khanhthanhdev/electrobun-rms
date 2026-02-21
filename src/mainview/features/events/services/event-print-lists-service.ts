import { requestJson } from "../../../shared/api/http-client";

export interface PrintableAccountItem {
  password: string | null;
  role: string;
  username: string;
}

export interface PrintableTeamItem {
  location: string;
  name: string;
  teamNumber: number;
}

export interface PrintableMatchItem {
  blueScore: number;
  fieldType: number;
  matchId: string;
  playNumber: number;
  redScore: number;
  startTime: string;
}

export interface PrintableScheduleItem {
  description: string;
  matchNumber: number | null;
  stage: string;
  startTime: string;
}

export interface EventPrintListsResponse {
  accounts: PrintableAccountItem[];
  eventCode: string;
  generatedAt: string;
  matches: PrintableMatchItem[];
  schedules: PrintableScheduleItem[];
  teams: PrintableTeamItem[];
}

export const fetchEventPrintLists = async (
  eventCode: string,
  token: string
): Promise<EventPrintListsResponse> =>
  requestJson<EventPrintListsResponse>(
    `/events/${encodeURIComponent(eventCode)}/print-lists`,
    {
      token,
    }
  );
