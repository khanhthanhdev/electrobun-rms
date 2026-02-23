import { useCallback, useEffect, useState } from "react";
import type { MatchBlockState } from "./schedule-utils";
import { useSchedulePageState } from "./schedule-utils";

interface ScheduleServerConfig {
  cycleTimeSeconds: number;
  startTime: number | null;
}

export interface OneVsOneLoadResult<TSchedule, TContext = undefined> {
  config: ScheduleServerConfig;
  context?: TContext;
  matchCount: number;
  schedule: TSchedule;
  teamCount: number;
}

export interface OneVsOneGenerateResult<TSchedule> {
  config?: ScheduleServerConfig;
  matchCount?: number;
  schedule: TSchedule;
  successMessage: string;
  teamCount?: number;
}

interface BuildGeneratePayloadInput {
  matchBlocks: MatchBlockState[];
  scheduleDate: string;
}

interface UseOneVsOneScheduleControllerOptions<
  TSchedule,
  TGeneratePayload,
  TContext = undefined,
> {
  buildGeneratePayload: (
    input: BuildGeneratePayloadInput
  ) => TGeneratePayload | Promise<TGeneratePayload>;
  defaultCycleMinutes: number;
  defaultEndTime?: string;
  eventCode: string;
  generateErrorMessage: string;
  generateSchedule: (
    eventCode: string,
    payload: TGeneratePayload,
    token: string
  ) => Promise<OneVsOneGenerateResult<TSchedule>>;
  loadErrorMessage: string;
  loadSchedule: (
    eventCode: string,
    token: string
  ) => Promise<OneVsOneLoadResult<TSchedule, TContext>>;
  missingGenerateTokenMessage: string;
  missingLoadTokenMessage: string;
  onGenerated?: (result: OneVsOneGenerateResult<TSchedule>) => void;
  onLoaded?: (result: OneVsOneLoadResult<TSchedule, TContext>) => void;
  token: string | null;
}

export const getFirstBlockStartTime = (
  scheduleDate: string,
  matchBlocks: MatchBlockState[]
): number => {
  const firstBlock = matchBlocks[0];
  if (!firstBlock) {
    throw new Error("You must have at least one match block.");
  }

  const startDate = new Date(`${scheduleDate}T${firstBlock.startTimeText}`);
  if (Number.isNaN(startDate.getTime())) {
    throw new Error("Invalid start date or time in the first match block.");
  }

  return startDate.getTime();
};

export const useOneVsOneScheduleController = <
  TSchedule,
  TGeneratePayload,
  TContext = undefined,
>({
  buildGeneratePayload,
  defaultCycleMinutes,
  defaultEndTime,
  eventCode,
  generateErrorMessage,
  generateSchedule,
  loadErrorMessage,
  loadSchedule,
  missingGenerateTokenMessage,
  missingLoadTokenMessage,
  onGenerated,
  onLoaded,
  token,
}: UseOneVsOneScheduleControllerOptions<
  TSchedule,
  TGeneratePayload,
  TContext
>) => {
  const {
    applyServerConfig,
    errorMessage,
    isGenerating,
    isLoading,
    matchBlocks,
    scheduleDate,
    setErrorMessage,
    setIsGenerating,
    setIsLoading,
    setMatchBlocks,
    setScheduleDate,
    setSuccessMessage,
    successMessage,
  } = useSchedulePageState({
    defaultCycleMinutes,
    defaultEndTime,
  });

  const [context, setContext] = useState<TContext | null>(null);
  const [schedule, setSchedule] = useState<TSchedule | null>(null);
  const [teamCount, setTeamCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      setErrorMessage(missingLoadTokenMessage);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    loadSchedule(eventCode, token)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setSchedule(result.schedule);
        setTeamCount(result.teamCount);
        setContext((result.context ?? null) as TContext | null);
        applyServerConfig(result.config, result.matchCount);
        onLoaded?.(result);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : loadErrorMessage
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    applyServerConfig,
    eventCode,
    loadErrorMessage,
    loadSchedule,
    missingLoadTokenMessage,
    onLoaded,
    setErrorMessage,
    setIsLoading,
    setSuccessMessage,
    token,
  ]);

  const handleGenerate = useCallback(async (): Promise<void> => {
    if (!token) {
      setErrorMessage(missingGenerateTokenMessage);
      return;
    }

    if (matchBlocks.length === 0) {
      setErrorMessage("You must have at least one match block.");
      return;
    }

    let payload: TGeneratePayload;
    try {
      payload = await buildGeneratePayload({ matchBlocks, scheduleDate });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : generateErrorMessage
      );
      return;
    }

    setIsGenerating(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await generateSchedule(eventCode, payload, token);
      setSchedule(result.schedule);

      if (typeof result.teamCount === "number") {
        setTeamCount(result.teamCount);
      }

      if (result.config && typeof result.matchCount === "number") {
        applyServerConfig(result.config, result.matchCount);
      }

      onGenerated?.(result);
      setSuccessMessage(result.successMessage);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : generateErrorMessage
      );
    } finally {
      setIsGenerating(false);
    }
  }, [
    applyServerConfig,
    buildGeneratePayload,
    eventCode,
    generateErrorMessage,
    generateSchedule,
    matchBlocks,
    missingGenerateTokenMessage,
    onGenerated,
    scheduleDate,
    setErrorMessage,
    setIsGenerating,
    setSuccessMessage,
    token,
  ]);

  return {
    context,
    errorMessage,
    handleGenerate,
    isGenerating,
    isLoading,
    matchBlocks,
    schedule,
    scheduleDate,
    setContext,
    setErrorMessage,
    setMatchBlocks,
    setSchedule,
    setScheduleDate,
    setSuccessMessage,
    setTeamCount,
    successMessage,
    teamCount,
  };
};
