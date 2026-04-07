import { useCallback, useEffect, useRef, useState } from "react";
import type { DisplayMatchRef } from "@shared/display";
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
import type { MatchScoresheet, MatchType } from "@/shared/types/scoring";
import type { DisplaySceneMode } from "./display-scene-types";
import { useDisplayRealtimeRefresh } from "./hooks/use-display-realtime-refresh";

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
    matchType: MatchType;
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

interface DisplaySceneSelection {
  activeMatch: DisplayMatchRef | null;
  loadedMatch: DisplayMatchRef | null;
  sceneMode: DisplaySceneMode;
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
  const loaded = rows.find((row) => row.state !== "COMMITTED") ?? rows[0];
  if (!loaded) {
    return null;
  }

  return {
    blueBreakdown: null,
    blueScore: loaded.blueScore ?? 0,
    blueTeam: loaded.blueTeam,
    blueTeamName: loaded.blueTeamName,
    fieldNumber: loaded.fieldNumber,
    matchName: loaded.matchName,
    matchNumber: loaded.matchNumber,
    matchType: type,
    redBreakdown: null,
    redScore: loaded.redScore ?? 0,
    redTeam: loaded.redTeam,
    redTeamName: loaded.redTeamName,
  };
};

const toLoadedMatchFromRef = (
  match: DisplayMatchRef
): DisplayData["loadedMatch"] => ({
  blueBreakdown: null,
  blueScore: 0,
  blueTeam: match.blueTeam,
  blueTeamName: match.blueTeamName ?? "",
  fieldNumber: match.fieldNumber,
  matchName: match.matchName,
  matchNumber: match.matchNumber,
  matchType: match.matchType,
  redBreakdown: null,
  redScore: 0,
  redTeam: match.redTeam,
  redTeamName: match.redTeamName ?? "",
});

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
    blueBreakdown: toScoreBreakdown(scoresheet.blue),
    blueScore: scoresheet.blue?.scoreTotal ?? match.blueScore,
    redBreakdown: toScoreBreakdown(scoresheet.red),
    redScore: scoresheet.red?.scoreTotal ?? match.redScore,
  };
};

const toRankings = (
  data: EventQualificationRankingsResponse | null
): DisplayData["rankings"] =>
  data?.rankings?.map((ranking, index) => ({
    rank: ranking.rank ?? index + 1,
    rp: ranking.rankingPoint ?? 0,
    teamName: ranking.name ?? "",
    teamNumber: ranking.teamNumber,
    total: ranking.total ?? 0,
    winPct:
      (ranking.played ?? 0) > 0
        ? `${Math.round(((ranking.wins ?? 0) / (ranking.played ?? 1)) * 100)}%`
        : "0%",
    wlt: `${ranking.wins ?? 0}-${ranking.losses ?? 0}-${ranking.ties ?? 0}`,
  })) ?? [];

const toMatchesPlayed = (
  data: EventQualificationRankingsResponse | null
): string => {
  if (!data?.rankings?.length) {
    return "";
  }

  const maxPlayed = Math.max(...data.rankings.map((ranking) => ranking.played ?? 0));
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
  const next = rows.find((row) => row.state === "UNPLAYED");
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
  data?.teams?.map((team) => ({
    status: team.status ?? "NOT_STARTED",
    teamName: team.teamName ?? "",
    teamNumber: team.teamNumber,
  })) ?? [];

const fetchAllDisplaySources = (
  eventCode: string,
  token: string | null
): Promise<
  [
    PromiseSettledResult<EventItem | null>,
    PromiseSettledResult<MatchControlData>,
    PromiseSettledResult<EventQualificationRankingsResponse | null>,
    PromiseSettledResult<{
      teams: Array<{
        teamName?: string | null;
        teamNumber: number;
        status?: string;
      }>;
    }>
  ]
> =>
  Promise.allSettled([
    fetchEventPublic(eventCode),
    fetchMatchControlData(eventCode, token),
    fetchQualificationRankings(eventCode, token, Date.now()),
    token
      ? fetchInspectionTeams(eventCode, token, "").catch(() => ({
          teams: [],
        }))
      : Promise.resolve({ teams: [] }),
  ]);

const unwrapSettled = <T>(result: PromiseSettledResult<T>): T | null =>
  result.status === "fulfilled" ? result.value : null;

const toMatchType = (value: string): MatchType | null =>
  value === "practice" || value === "quals" || value === "elims"
    ? value
    : null;

const resolveDisplaySceneMatch = (
  control: MatchControlData | null,
  selection: DisplaySceneSelection
): DisplayData["loadedMatch"] => {
  const fallbackMatch = control ? toLoadedMatch(control) : null;
  const loadedMatch = selection.loadedMatch
    ? toLoadedMatchFromRef(selection.loadedMatch)
    : null;
  const activeMatch = selection.activeMatch
    ? toLoadedMatchFromRef(selection.activeMatch)
    : null;

  switch (selection.sceneMode) {
    case "match-preview":
      return loadedMatch ?? activeMatch ?? fallbackMatch;
    case "match-start":
    case "match-winner":
      return activeMatch ?? loadedMatch ?? fallbackMatch;
    default:
      return null;
  }
};

const loadMatchWithScoresheet = async (
  eventCode: string,
  match: DisplayData["loadedMatch"]
): Promise<DisplayData["loadedMatch"]> => {
  if (!match) {
    return null;
  }

  const matchType = toMatchType(match.matchType);
  if (!matchType) {
    return match;
  }

  try {
    const scoresheet = await fetchMatchScoresheet(
      eventCode,
      matchType,
      match.matchNumber,
      null
    );
    return applyScoresheet(match, scoresheet);
  } catch {
    return match;
  }
};

export const useDisplayData = (
  eventCode: string,
  token: string | null,
  selection: DisplaySceneSelection
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
    const control = unwrapSettled(controlRes);
    const rankingsData = unwrapSettled(rankingsRes);
    const inspectionData = unwrapSettled(inspectionRes);
    const sceneMatch = resolveDisplaySceneMatch(control, selection);
    const loadedMatch = await loadMatchWithScoresheet(eventCode, sceneMatch);

    if (rid !== requestIdRef.current) {
      return;
    }

    setData({
      eventName: event?.name ?? eventCode,
      inspectionTeams: toInspectionTeams(inspectionData),
      loadedMatch,
      matchesPlayed: toMatchesPlayed(rankingsData),
      nextMatchStartTime: toNextMatchStartTime(control),
      rankings: toRankings(rankingsData),
    });
  }, [
    eventCode,
    selection.activeMatch,
    selection.loadedMatch,
    selection.sceneMode,
    token,
  ]);

  useScoringRealtime(eventCode, token);
  useScoringRealtimeRefresh(eventCode, load);
  useDisplayRealtimeRefresh(eventCode, load);

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
