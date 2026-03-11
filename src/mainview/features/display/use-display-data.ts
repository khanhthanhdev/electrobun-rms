import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMatchControlData } from "@/features/events/control";
import { fetchQualificationRankings } from "@/features/events/rankings";
import type { EventQualificationRankingsResponse } from "@/features/events/rankings/qualification-rankings-service";
import { fetchInspectionTeams } from "@/features/inspection/services/inspection-service";
import { useScoringRealtime } from "@/features/scoring/hooks/use-scoring-realtime";
import { useScoringRealtimeRefresh } from "@/features/scoring/hooks/use-scoring-realtime-refresh";
import { requestJson } from "@/shared/api/http-client";
import { fetchMatchScoresheet } from "@/shared/api/scoring";
import type { EventItem } from "@/shared/types/event";
import type { MatchControlData } from "@/shared/types/match-control";
import type { MatchScoresheet } from "@/shared/types/scoring";

interface FetchEventResponse {
  event: EventItem;
}

export interface ScoreBreakdown {
  a: number;
  b: number;
  c: number;
  d: number;
  total: number;
}

export interface DisplayData {
  eventName: string;
  inspectionTeams: Array<{
    teamNumber: number;
    teamName: string;
    status: string;
  }>;
  loadedMatch: {
    blueBreakdown: ScoreBreakdown | null;
    blueScore: number;
    blueTeam: number;
    blueTeamName: string;
    fieldNumber: number;
    matchName: string;
    matchNumber: number;
    matchType: string;
    redBreakdown: ScoreBreakdown | null;
    redScore: number;
    redTeam: number;
    redTeamName: string;
  } | null;
  matchesPlayed: string;
  nextMatchStartTime: number | null;
  rankings: Array<{
    rank: number;
    teamNumber: number;
    teamName: string;
    rp: number;
    total: number;
    wlt: string;
    winPct: string;
  }>;
}

const emptyDisplayData: DisplayData = {
  eventName: "",
  inspectionTeams: [],
  loadedMatch: null,
  matchesPlayed: "",
  nextMatchStartTime: null,
  rankings: [],
};

const fetchEventPublic = async (
  eventCode: string
): Promise<EventItem | null> => {
  try {
    const res = await requestJson<FetchEventResponse>(
      `/events/${encodeURIComponent(eventCode)}`,
      {}
    );
    return res.event ?? null;
  } catch {
    return null;
  }
};

const toLoadedMatch = (
  control: MatchControlData
): DisplayData["loadedMatch"] => {
  const type = control.activeScheduleType ?? "quals";
  const rows = control.byType[type] ?? [];
  const loaded = rows.find((r) => r.state !== "COMMITTED") ?? rows[0];
  if (!loaded) {
    return null;
  }
  return {
    matchName: loaded.matchName,
    matchNumber: loaded.matchNumber,
    matchType: type,
    fieldNumber: loaded.fieldNumber,
    redTeam: loaded.redTeam,
    redTeamName: loaded.redTeamName,
    redScore: loaded.redScore ?? 0,
    redBreakdown: null,
    blueTeam: loaded.blueTeam,
    blueTeamName: loaded.blueTeamName,
    blueScore: loaded.blueScore ?? 0,
    blueBreakdown: null,
  };
};

const toScoreBreakdown = (
  item: {
    scoreA: number;
    scoreB: number;
    scoreC: number;
    scoreD: number;
    scoreTotal: number;
  } | null
): ScoreBreakdown | null => {
  if (!item) {
    return null;
  }
  return {
    a: item.scoreA,
    b: item.scoreB,
    c: item.scoreC,
    d: item.scoreD,
    total: item.scoreTotal,
  };
};

const applyScoresheet = (
  match: DisplayData["loadedMatch"],
  scoresheet: MatchScoresheet | null
): DisplayData["loadedMatch"] => {
  if (!(match && scoresheet)) {
    return match;
  }
  return {
    ...match,
    redBreakdown: toScoreBreakdown(scoresheet.red),
    blueBreakdown: toScoreBreakdown(scoresheet.blue),
    redScore: scoresheet.red?.scoreTotal ?? match.redScore,
    blueScore: scoresheet.blue?.scoreTotal ?? match.blueScore,
  };
};

const toRankings = (
  data: EventQualificationRankingsResponse | null
): DisplayData["rankings"] =>
  data?.rankings?.map((r, i) => ({
    rank: r.rank ?? i + 1,
    teamNumber: r.teamNumber,
    teamName: r.name ?? "",
    rp: r.rankingPoint ?? 0,
    total: r.total ?? 0,
    wlt: `${r.wins ?? 0}-${r.losses ?? 0}-${r.ties ?? 0}`,
    winPct:
      (r.played ?? 0) > 0
        ? `${Math.round(((r.wins ?? 0) / (r.played ?? 1)) * 100)}%`
        : "0%",
  })) ?? [];

const toMatchesPlayed = (
  data: EventQualificationRankingsResponse | null
): string => {
  if (!data?.rankings?.length) {
    return "";
  }
  const maxPlayed = Math.max(...data.rankings.map((r) => r.played ?? 0));
  return `${maxPlayed} matches played`;
};

const toNextMatchStartTime = (
  control: MatchControlData | null
): number | null => {
  if (!control) {
    return null;
  }
  const type = control.activeScheduleType ?? "quals";
  const rows = control.byType[type] ?? [];
  const next = rows.find((r) => r.state === "UNPLAYED");
  return next?.startTime ?? null;
};

const toInspectionTeams = (
  data: {
    teams?: Array<{
      teamName?: string | null;
      teamNumber: number;
      status?: string;
    }>;
  } | null
): DisplayData["inspectionTeams"] =>
  data?.teams?.map((t) => ({
    teamNumber: t.teamNumber,
    teamName: t.teamName ?? "",
    status: t.status ?? "NOT_STARTED",
  })) ?? [];

const fetchAllDisplaySources = (
  eventCode: string,
  token: string | null
): Promise<
  [
    PromiseSettledResult<EventItem | null>,
    PromiseSettledResult<MatchControlData | null>,
    PromiseSettledResult<EventQualificationRankingsResponse | null>,
    PromiseSettledResult<{
      teams: Array<{
        teamName?: string | null;
        teamNumber: number;
        status?: string;
      }>;
    }>,
  ]
> =>
  Promise.allSettled([
    fetchEventPublic(eventCode),
    token ? fetchMatchControlData(eventCode, token) : null,
    fetchQualificationRankings(eventCode, token, Date.now()),
    token
      ? fetchInspectionTeams(eventCode, token, "").catch(() => ({
          teams: [],
        }))
      : Promise.resolve({ teams: [] }),
  ]);

const unwrapSettled = <T>(result: PromiseSettledResult<T>): T | null =>
  result.status === "fulfilled" ? result.value : null;

const loadMatchWithScoresheet = async (
  eventCode: string,
  token: string | null,
  control: MatchControlData | null
): Promise<DisplayData["loadedMatch"]> => {
  const match = control ? toLoadedMatch(control) : null;
  if (!(match && token)) {
    return match;
  }
  try {
    const scoresheet = await fetchMatchScoresheet(
      eventCode,
      match.matchType as "practice" | "quals",
      match.matchNumber,
      token
    );
    return applyScoresheet(match, scoresheet);
  } catch {
    return match;
  }
};

export const useDisplayData = (
  eventCode: string,
  token: string | null
): DisplayData => {
  const [data, setData] = useState<DisplayData>(emptyDisplayData);
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    const rid = ++requestIdRef.current;

    const [eventRes, controlRes, rankingsRes, inspectionRes] =
      await fetchAllDisplaySources(eventCode, token);

    if (rid !== requestIdRef.current) {
      return;
    }

    const event = unwrapSettled(eventRes);
    const control = unwrapSettled(controlRes) ?? null;
    const rankingsData = unwrapSettled(rankingsRes);
    const inspectionData = unwrapSettled(inspectionRes);

    const loadedMatch = await loadMatchWithScoresheet(
      eventCode,
      token,
      control
    );

    if (rid !== requestIdRef.current) {
      return;
    }

    setData({
      eventName: event?.name ?? eventCode,
      loadedMatch,
      matchesPlayed: toMatchesPlayed(rankingsData),
      nextMatchStartTime: toNextMatchStartTime(control),
      rankings: toRankings(rankingsData),
      inspectionTeams: toInspectionTeams(inspectionData),
    });
  }, [eventCode, token]);

  useScoringRealtime(eventCode, token);
  useScoringRealtimeRefresh(eventCode, load);

  useEffect(() => {
    load();
    const pollMs = token ? 10_000 : 5000;
    const id = window.setInterval(load, pollMs);
    return () => {
      window.clearInterval(id);
    };
  }, [load, token]);

  return data;
};
