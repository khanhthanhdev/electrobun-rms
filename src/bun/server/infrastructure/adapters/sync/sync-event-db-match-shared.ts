import {
  DEFAULT_MATCH_CYCLE_MS,
  DEFAULT_MATCH_DURATION_MS,
  MATCH_STATUS_COMPLETE,
  parseRequiredTeamNumber,
} from "./sync-event-db-shared";
import type {
  MatchLineup,
  MatchPhase,
  MatchType,
  SyncRecord,
} from "./sync-event-db-types";

export const resolveMatchType = (phase: MatchPhase): MatchType => {
  if (phase === "PRACTICE") {
    return "practice";
  }

  if (phase === "PLAYOFF") {
    return "elims";
  }

  return "quals";
};

export const resolveAllianceTeams = (
  record: SyncRecord
): { blueTeam: number; redTeam: number } => {
  const alliances = Array.isArray(record.alliances)
    ? (record.alliances as Array<{ color?: string; teamNumbers?: unknown[] }>)
    : [];

  const red = alliances.find((entry) => entry.color === "RED");
  const blue = alliances.find((entry) => entry.color === "BLUE");
  if (!(red?.teamNumbers?.length && blue?.teamNumbers?.length)) {
    throw new Error("Match records require one RED and one BLUE alliance.");
  }

  return {
    blueTeam: parseRequiredTeamNumber(blue.teamNumbers[0]),
    redTeam: parseRequiredTeamNumber(red.teamNumbers[0]),
  };
};

export const resolveMatchStatus = (status: unknown): number =>
  MATCH_STATUS_COMPLETE.has(String(status).toUpperCase()) ? 1 : 0;

export const inferCycleTime = (matches: MatchLineup[]): number => {
  if (matches.length < 2) {
    return DEFAULT_MATCH_CYCLE_MS;
  }

  const sortedStarts = [...matches]
    .map((match) => match.scheduledAt)
    .filter((value) => value > 0)
    .sort((left, right) => left - right);

  if (sortedStarts.length < 2) {
    return DEFAULT_MATCH_CYCLE_MS;
  }

  return Math.max(DEFAULT_MATCH_DURATION_MS, sortedStarts[1] - sortedStarts[0]);
};
