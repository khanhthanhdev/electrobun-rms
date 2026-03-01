import { useCallback, useState } from "react";

export interface MatchBlockState {
  cycleTimeMinutes: number;
  endTimeText: string;
  id: string;
  startTimeText: string;
}

export const formatDisplayTime = (timestamp: number): string =>
  new Date(timestamp).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

export const formatTimeForInput = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

export const getTodayDateString = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export const formatDateString = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

export interface BlockCapacity {
  durationMinutes: number;
  matchesInBlock: number;
}

const MS_IN_MINUTE = 60_000;
const MS_IN_SECOND = 1000;

const toSafeFieldCount = (fieldCount: number): number =>
  Math.max(1, fieldCount);

const toSafeFieldOffsetMs = (fieldStartOffsetSeconds: number): number =>
  Math.max(0, fieldStartOffsetSeconds) * MS_IN_SECOND;

export const computeMatchCountForDurationMs = (
  durationMs: number,
  cycleTimeMinutes: number,
  fieldCount = 1,
  fieldStartOffsetSeconds = 0
): number => {
  if (durationMs <= 0 || cycleTimeMinutes <= 0) {
    return 0;
  }

  const cycleTimeMs = cycleTimeMinutes * MS_IN_MINUTE;
  const safeFieldCount = toSafeFieldCount(fieldCount);
  const fieldOffsetMs = toSafeFieldOffsetMs(fieldStartOffsetSeconds);

  let matchesInBlock = 0;
  for (
    let roundStartOffsetMs = 0;
    roundStartOffsetMs < durationMs;
    roundStartOffsetMs += cycleTimeMs
  ) {
    let hasMatchesInRound = false;

    for (let fieldIndex = 0; fieldIndex < safeFieldCount; fieldIndex += 1) {
      const matchStartOffsetMs =
        roundStartOffsetMs + fieldIndex * fieldOffsetMs;
      if (matchStartOffsetMs >= durationMs) {
        continue;
      }

      matchesInBlock += 1;
      hasMatchesInRound = true;
    }

    if (!hasMatchesInRound) {
      break;
    }
  }

  return matchesInBlock;
};

export const computeRequiredBlockDurationMsForMatchCount = (
  matchCount: number,
  cycleTimeMinutes: number,
  fieldCount = 1,
  fieldStartOffsetSeconds = 0
): number => {
  if (matchCount <= 0 || cycleTimeMinutes <= 0) {
    return 0;
  }

  const cycleTimeMs = cycleTimeMinutes * MS_IN_MINUTE;
  const safeFieldCount = toSafeFieldCount(fieldCount);
  const fieldOffsetMs = toSafeFieldOffsetMs(fieldStartOffsetSeconds);

  let matchesAssigned = 0;
  for (let roundStartOffsetMs = 0; ; roundStartOffsetMs += cycleTimeMs) {
    for (let fieldIndex = 0; fieldIndex < safeFieldCount; fieldIndex += 1) {
      const matchStartOffsetMs =
        roundStartOffsetMs + fieldIndex * fieldOffsetMs;
      matchesAssigned += 1;
      if (matchesAssigned >= matchCount) {
        return matchStartOffsetMs + 1;
      }
    }
  }
};

export const computeMinimumBlockDurationMinutesForMatchCount = (
  matchCount: number,
  cycleTimeMinutes: number,
  fieldCount = 1,
  fieldStartOffsetSeconds = 0
): number => {
  if (matchCount <= 0 || cycleTimeMinutes <= 0) {
    return 0;
  }

  const upperBoundMinutes = Math.max(
    1,
    Math.ceil(
      computeRequiredBlockDurationMsForMatchCount(
        matchCount,
        cycleTimeMinutes,
        fieldCount,
        fieldStartOffsetSeconds
      ) / MS_IN_MINUTE
    )
  );

  for (
    let durationMinutes = 0;
    durationMinutes <= upperBoundMinutes;
    durationMinutes += 1
  ) {
    const durationMs = durationMinutes * MS_IN_MINUTE;
    const capacity = computeMatchCountForDurationMs(
      durationMs,
      cycleTimeMinutes,
      fieldCount,
      fieldStartOffsetSeconds
    );
    if (capacity >= matchCount) {
      return durationMinutes;
    }
  }

  return upperBoundMinutes;
};

export const computeBlockCapacity = (
  block: MatchBlockState,
  scheduleDate: string,
  fieldCount = 1,
  fieldStartOffsetSeconds = 0
): BlockCapacity => {
  const startDate = new Date(`${scheduleDate}T${block.startTimeText}`);
  const endDate = new Date(`${scheduleDate}T${block.endTimeText}`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { matchesInBlock: 0, durationMinutes: 0 };
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  const durationMinutes = Math.floor(durationMs / 60_000);

  if (durationMs <= 0 || block.cycleTimeMinutes <= 0) {
    return { matchesInBlock: 0, durationMinutes: Math.max(0, durationMinutes) };
  }

  return {
    matchesInBlock: computeMatchCountForDurationMs(
      durationMs,
      block.cycleTimeMinutes,
      fieldCount,
      fieldStartOffsetSeconds
    ),
    durationMinutes,
  };
};

export const buildInitialMatchBlocks = (
  startTime: number,
  matchCount: number,
  cycleTimeSeconds: number,
  defaultCycleMinutes: number,
  fieldCount = 1,
  fieldStartOffsetSeconds = 0
): MatchBlockState[] => {
  const cycleMinutes = Math.floor(cycleTimeSeconds / 60) || defaultCycleMinutes;
  const safeFieldCount = toSafeFieldCount(fieldCount);
  const endTimestamp =
    fieldStartOffsetSeconds > 0
      ? startTime +
        computeMinimumBlockDurationMinutesForMatchCount(
          matchCount,
          cycleMinutes,
          safeFieldCount,
          fieldStartOffsetSeconds
        ) *
          MS_IN_MINUTE
      : startTime +
        Math.ceil(matchCount / safeFieldCount) * cycleMinutes * MS_IN_MINUTE;

  return [
    {
      id: "block-initial",
      startTimeText: formatTimeForInput(startTime),
      endTimeText: formatTimeForInput(endTimestamp),
      cycleTimeMinutes: cycleMinutes,
    },
  ];
};

interface ScheduleServerConfig {
  cycleTimeSeconds: number;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  startTime: number | null;
}

interface UseSchedulePageStateOptions {
  defaultCycleMinutes: number;
  defaultEndTime?: string;
}

export const useSchedulePageState = ({
  defaultCycleMinutes,
  defaultEndTime = "09:00",
}: UseSchedulePageStateOptions) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState(getTodayDateString);
  const [matchBlocks, setMatchBlocks] = useState<MatchBlockState[]>([
    {
      id: "block-1",
      startTimeText: "08:00",
      endTimeText: defaultEndTime,
      cycleTimeMinutes: defaultCycleMinutes,
    },
  ]);

  const applyServerConfig = useCallback(
    (config: ScheduleServerConfig, matchCount: number) => {
      if (!config.startTime) {
        return;
      }
      setScheduleDate(formatDateString(config.startTime));
      if (matchCount > 0) {
        setMatchBlocks(
          buildInitialMatchBlocks(
            config.startTime,
            matchCount,
            config.cycleTimeSeconds,
            defaultCycleMinutes,
            config.fieldCount ?? 1,
            config.fieldStartOffsetSeconds ?? 0
          )
        );
      }
    },
    [defaultCycleMinutes]
  );

  return {
    isLoading,
    setIsLoading,
    isGenerating,
    setIsGenerating,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    scheduleDate,
    setScheduleDate,
    matchBlocks,
    setMatchBlocks,
    applyServerConfig,
  };
};
