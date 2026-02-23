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

export const computeBlockCapacity = (
  block: MatchBlockState,
  scheduleDate: string
): BlockCapacity => {
  const startDate = new Date(`${scheduleDate}T${block.startTimeText}`);
  const endDate = new Date(`${scheduleDate}T${block.endTimeText}`);

  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return { matchesInBlock: 0, durationMinutes: 0 };
  }

  const durationMinutes = Math.floor(
    (endDate.getTime() - startDate.getTime()) / 60_000
  );

  if (durationMinutes <= 0) {
    return { matchesInBlock: 0, durationMinutes: 0 };
  }

  const matchesInBlock =
    block.cycleTimeMinutes > 0
      ? Math.floor(durationMinutes / block.cycleTimeMinutes)
      : 0;

  return { matchesInBlock, durationMinutes };
};

export const buildInitialMatchBlocks = (
  startTime: number,
  matchCount: number,
  cycleTimeSeconds: number,
  defaultCycleMinutes: number
): MatchBlockState[] => {
  const cycleMinutes = Math.floor(cycleTimeSeconds / 60) || defaultCycleMinutes;
  const endTimestamp = startTime + matchCount * cycleMinutes * 60 * 1000;

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
            defaultCycleMinutes
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
