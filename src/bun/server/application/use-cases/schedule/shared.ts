import { getActiveSeasonRules } from "../../../domain/season-rules";
import { ApplicationError } from "../../common/application-error";
import type {
  OneVsOneScheduleMatch,
  SaveOneVsOneScheduleMatchInput,
} from "../../dtos/schedule";

const timingRules = getActiveSeasonRules().timing;

export const DEFAULT_MATCH_TIME_SECONDS = timingRules.matchDurationSeconds;
export const DEFAULT_PRACTICE_CYCLE_TIME_SECONDS =
  timingRules.defaultCycleTimeSecondsByType.practice ?? 180;
export const DEFAULT_QUALS_CYCLE_TIME_SECONDS =
  timingRules.defaultCycleTimeSecondsByType.quals ?? 240;
export const DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS =
  timingRules.defaultFieldStartOffsetSecondsByType.quals ?? 15;
export const DEFAULT_QUALS_MATCHES_PER_TEAM = timingRules.defaultMatchesPerTeam;
export const MIN_REST_GAP = 3;

export const normalizeScheduleEventCode = (eventCode: string): string => {
  const normalizedEventCode = eventCode.trim();
  if (!normalizedEventCode) {
    throw new ApplicationError("Event code is required.", 400);
  }

  if (
    normalizedEventCode.includes("/") ||
    normalizedEventCode.includes("\\") ||
    normalizedEventCode.includes("..")
  ) {
    throw new ApplicationError(
      `Invalid event code "${normalizedEventCode}".`,
      400
    );
  }

  return normalizedEventCode;
};

export const normalizePositiveInteger = (
  value: number | undefined,
  fallbackValue: number,
  label: string
): number => {
  const normalizedValue = value ?? fallbackValue;
  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new ApplicationError(
      `${label} must be a positive whole number.`,
      400
    );
  }
  return normalizedValue;
};

export const normalizeNonNegativeInteger = (
  value: number | undefined,
  fallbackValue: number,
  label: string
): number => {
  const normalizedValue = value ?? fallbackValue;
  if (!Number.isInteger(normalizedValue) || normalizedValue < 0) {
    throw new ApplicationError(
      `${label} must be a non-negative whole number.`,
      400
    );
  }
  return normalizedValue;
};

export const normalizeTimestamp = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ApplicationError(
      "startTime must be a valid Unix millisecond value.",
      400
    );
  }
  return Math.trunc(value);
};

export const normalizeLineupInput = (
  matches: SaveOneVsOneScheduleMatchInput[]
): SaveOneVsOneScheduleMatchInput[] => {
  const seenMatchNumbers = new Set<number>();
  const normalizedMatches = [...matches].sort(
    (left, right) => left.matchNumber - right.matchNumber
  );

  for (const match of normalizedMatches) {
    if (!Number.isInteger(match.matchNumber) || match.matchNumber <= 0) {
      throw new ApplicationError(
        "Each matchNumber must be a positive integer.",
        400
      );
    }
    if (seenMatchNumbers.has(match.matchNumber)) {
      throw new ApplicationError(
        `Duplicate matchNumber ${match.matchNumber} in payload.`,
        400
      );
    }
    seenMatchNumbers.add(match.matchNumber);

    if (!Number.isInteger(match.redTeam) || match.redTeam <= 0) {
      throw new ApplicationError(
        `Match ${match.matchNumber}: redTeam must be a positive integer.`,
        400
      );
    }

    if (!Number.isInteger(match.blueTeam) || match.blueTeam <= 0) {
      throw new ApplicationError(
        `Match ${match.matchNumber}: blueTeam must be a positive integer.`,
        400
      );
    }

    if (match.redTeam === match.blueTeam) {
      throw new ApplicationError(
        `Match ${match.matchNumber}: redTeam and blueTeam cannot be the same team.`,
        400
      );
    }
  }

  return normalizedMatches;
};

export const computeMatchTimes = (
  matchIndex: number,
  startTime: number,
  cycleTimeSeconds: number,
  options?: {
    fieldCount?: number;
    fieldStartOffsetSeconds?: number;
  }
): { endTime: number; startTime: number } => {
  const fieldCount = Math.max(1, options?.fieldCount ?? 1);
  const fieldStartOffsetMs = (options?.fieldStartOffsetSeconds ?? 0) * 1000;
  const cycleTimeMs = cycleTimeSeconds * 1000;
  const roundIndex = Math.floor(matchIndex / fieldCount);
  const fieldIndex = matchIndex % fieldCount;
  const startOffset =
    roundIndex * cycleTimeMs + fieldIndex * fieldStartOffsetMs;
  const computedStartTime = startTime + startOffset;

  return {
    startTime: computedStartTime,
    endTime: computedStartTime + DEFAULT_MATCH_TIME_SECONDS * 1000,
  };
};

export const buildScheduleWindowFromMatches = (
  matches: OneVsOneScheduleMatch[],
  fallbackStartTime: number
): { endTime: number; startTime: number } => {
  if (matches.length === 0) {
    return {
      startTime: fallbackStartTime,
      endTime: fallbackStartTime + DEFAULT_MATCH_TIME_SECONDS * 1000,
    };
  }

  let earliestStart = matches[0].startTime;
  let latestEnd = matches[0].endTime;
  for (const match of matches) {
    earliestStart = Math.min(earliestStart, match.startTime);
    latestEnd = Math.max(latestEnd, match.endTime);
  }

  return {
    startTime: earliestStart,
    endTime: latestEnd,
  };
};

export const countQualificationMatchesPerTeam = (
  matches: SaveOneVsOneScheduleMatchInput[]
): number => {
  const teamMatchCounts = new Map<number, number>();
  for (const match of matches) {
    if (!match.redSurrogate) {
      teamMatchCounts.set(
        match.redTeam,
        (teamMatchCounts.get(match.redTeam) ?? 0) + 1
      );
    }
    if (!match.blueSurrogate) {
      teamMatchCounts.set(
        match.blueTeam,
        (teamMatchCounts.get(match.blueTeam) ?? 0) + 1
      );
    }
  }

  return teamMatchCounts.size > 0
    ? Math.max(...teamMatchCounts.values())
    : DEFAULT_QUALS_MATCHES_PER_TEAM;
};

export const calculateRestPenalty = (
  currentRound: number,
  lastRoundByTeam: Map<number, number>,
  teamNumber: number
): number => {
  const previousRound = lastRoundByTeam.get(teamNumber);
  if (previousRound === undefined) {
    return 0;
  }

  const gap = currentRound - previousRound;
  if (gap <= 1) {
    return 500;
  }
  if (gap <= 2) {
    return 200;
  }
  if (gap <= MIN_REST_GAP) {
    return 80;
  }
  return 0;
};
