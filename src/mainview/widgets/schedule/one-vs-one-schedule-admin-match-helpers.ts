import type { Dispatch, SetStateAction } from "react";
import {
  buildMatchesCsvFileContent,
  type OneVsOneCsvMatch,
} from "./schedule-csv";
import type { ScheduleMatchRow } from "./schedule-match-table";
import type { MatchBlockState } from "./schedule-utils";
import { getFirstBlockStartTime } from "./use-one-vs-one-schedule-controller";
import type {
  OneVsOneEditableMatch,
  OneVsOneSaveMatch,
  ScheduleMessageSetter,
  TeamNamesByNumber,
} from "./one-vs-one-schedule-admin-types";

const MS_IN_SECOND = 1000;

interface ResolveFirstBlockTimingArgs {
  matchBlocks: MatchBlockState[];
  scheduleDate: string;
  setErrorMessage: ScheduleMessageSetter;
}

export const resolveOneVsOneFirstBlockTiming = ({
  matchBlocks,
  scheduleDate,
  setErrorMessage,
}: ResolveFirstBlockTimingArgs): {
  cycleTimeSeconds: number;
  startTime: number;
} | null => {
  let startTime: number;
  try {
    startTime = getFirstBlockStartTime(scheduleDate, matchBlocks);
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "Invalid start time."
    );
    return null;
  }

  const firstBlock = matchBlocks[0];
  if (!firstBlock) {
    setErrorMessage("You must have at least one match block.");
    return null;
  }

  return {
    startTime,
    cycleTimeSeconds: firstBlock.cycleTimeMinutes * 60,
  };
};

export const updateOneVsOneCycleTime = (
  setMatchBlocks: Dispatch<SetStateAction<MatchBlockState[]>>,
  seconds: number
): void => {
  const minutes = Math.max(1, seconds) / 60;
  setMatchBlocks((previousBlocks) =>
    previousBlocks.map((block) => ({ ...block, cycleTimeMinutes: minutes }))
  );
};

export const mapCsvMatchesToScheduleMatches = (
  matches: OneVsOneCsvMatch[]
): OneVsOneSaveMatch[] =>
  matches.map((match) => ({
    matchNumber: match.matchNumber,
    redTeam: match.redTeam,
    blueTeam: match.blueTeam,
    redSurrogate: match.redSurrogate,
    blueSurrogate: match.blueSurrogate,
  }));

export const mapScheduleMatchesToEditable = <
  TMatch extends OneVsOneEditableMatch,
>(
  matches: readonly TMatch[]
): OneVsOneEditableMatch[] =>
  matches.map((match) => ({
    matchNumber: match.matchNumber,
    redTeam: match.redTeam,
    redTeamName: match.redTeamName,
    blueTeam: match.blueTeam,
    blueTeamName: match.blueTeamName,
    redSurrogate: match.redSurrogate,
    blueSurrogate: match.blueSurrogate,
  }));

interface BuildOneVsOneMatchRowsArgs<TMatch extends OneVsOneEditableMatch> {
  baseStartTime: number;
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldNumberForMatch?: (
    match: TMatch,
    index: number,
    safeFieldCount: number
  ) => number;
  fieldStartOffsetSeconds: number;
  labelPrefix: string;
  matches: readonly TMatch[];
  teamNamesByNumber: TeamNamesByNumber;
}

export const buildOneVsOneMatchRows = <
  TMatch extends OneVsOneEditableMatch,
>({
  baseStartTime,
  cycleTimeSeconds,
  fieldCount,
  fieldNumberForMatch,
  fieldStartOffsetSeconds,
  labelPrefix,
  matches,
  teamNamesByNumber,
}: BuildOneVsOneMatchRowsArgs<TMatch>): ScheduleMatchRow[] => {
  const safeFieldCount = Math.max(1, fieldCount);
  const cycleTimeMs = cycleTimeSeconds * MS_IN_SECOND;
  const fieldOffsetMs = Math.max(0, fieldStartOffsetSeconds) * MS_IN_SECOND;

  return matches.map((match, index) => {
    const roundIndex = Math.floor(index / safeFieldCount);
    const fieldIndex = index % safeFieldCount;
    const startTime =
      baseStartTime + roundIndex * cycleTimeMs + fieldIndex * fieldOffsetMs;

    return {
      matchNumber: match.matchNumber,
      startTime,
      matchLabel: `${labelPrefix} ${match.matchNumber}`,
      fieldNumber:
        fieldNumberForMatch?.(match, index, safeFieldCount) ?? fieldIndex + 1,
      redTeam: match.redTeam,
      redTeamName: match.redTeamName ?? teamNamesByNumber[match.redTeam],
      redSurrogate: match.redSurrogate ?? false,
      blueTeam: match.blueTeam,
      blueTeamName: match.blueTeamName ?? teamNamesByNumber[match.blueTeam],
      blueSurrogate: match.blueSurrogate ?? false,
    };
  });
};

export const buildOneVsOneMatchRowsFromFirstBlock = <
  TMatch extends OneVsOneEditableMatch,
>({
  firstBlock,
  scheduleDate,
  ...args
}: Omit<
  BuildOneVsOneMatchRowsArgs<TMatch>,
  "baseStartTime" | "cycleTimeSeconds"
> & {
  firstBlock: MatchBlockState | undefined;
  scheduleDate: string;
}): ScheduleMatchRow[] => {
  if (!firstBlock) {
    return buildOneVsOneMatchRows({
      ...args,
      baseStartTime: Date.now(),
      cycleTimeSeconds: 0,
    });
  }

  const blockDate = new Date(`${scheduleDate}T${firstBlock.startTimeText}`);
  if (Number.isNaN(blockDate.getTime())) {
    return buildOneVsOneMatchRows({
      ...args,
      baseStartTime: Date.now(),
      cycleTimeSeconds: 0,
    });
  }

  return buildOneVsOneMatchRows({
    ...args,
    baseStartTime: blockDate.getTime(),
    cycleTimeSeconds: firstBlock.cycleTimeMinutes * 60,
  });
};

export const exportOneVsOneMatchesCsv = ({
  eventCode,
  fileSuffix,
  rows,
}: {
  eventCode: string;
  fileSuffix: string;
  rows: ScheduleMatchRow[];
}): void => {
  const csvContent = buildMatchesCsvFileContent(rows);
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const linkElement = document.createElement("a");
  linkElement.href = objectUrl;
  linkElement.download = `${eventCode}-${fileSuffix}.csv`;
  linkElement.click();
  URL.revokeObjectURL(objectUrl);
};
