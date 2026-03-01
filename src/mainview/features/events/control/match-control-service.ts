import { fetchMatchResults } from "@/shared/api/scoring";
import type {
  ControlMatchRow,
  ControlMatchState,
  ControlMatchType,
  MatchControlData,
} from "@/shared/types/match-control";
import type { MatchResultItem } from "@/shared/types/scoring";
import {
  fetchPracticeSchedule,
  type PracticeScheduleResponse,
} from "../schedule/practice-schedule-service";
import {
  fetchQualificationSchedule,
  type QualificationScheduleResponse,
} from "../schedule/qualification-schedule-service";

const MATCH_TYPE_ORDER: ControlMatchType[] = ["practice", "quals"];
const MATCH_NAME_PREFIX: Record<ControlMatchType, string> = {
  practice: "P",
  quals: "Q",
};
type ScheduleResponse =
  | PracticeScheduleResponse
  | QualificationScheduleResponse;
const createEmptyRowsByType = (): Record<
  ControlMatchType,
  ControlMatchRow[]
> => ({
  practice: [],
  quals: [],
});
const toTeamName = (teamNumber: number, teamName: string): string =>
  teamName.trim() || `Team ${teamNumber}`;
const toMatchState = (
  redScore: number | null,
  blueScore: number | null
): ControlMatchState => {
  if (redScore !== null && blueScore !== null) {
    return "COMMITTED";
  }
  if (redScore !== null || blueScore !== null) {
    return "INCOMPLETE";
  }
  return "UNPLAYED";
};

const toResultByMatchNumber = (
  results: MatchResultItem[]
): Map<number, MatchResultItem> => {
  const mapped = new Map<number, MatchResultItem>();
  for (const result of results) {
    mapped.set(result.matchNumber, result);
  }
  return mapped;
};

const toControlRows = (
  matchType: ControlMatchType,
  schedule: ScheduleResponse,
  resultByMatchNumber: Map<number, MatchResultItem>
): ControlMatchRow[] => {
  const rows: ControlMatchRow[] = [];
  const fieldCount = Math.max(1, schedule.config.fieldCount);
  for (const match of schedule.matches) {
    const fieldNumber = ((match.matchNumber - 1) % fieldCount) + 1;
    const roundNumber = Math.floor((match.matchNumber - 1) / fieldCount) + 1;
    const result = resultByMatchNumber.get(match.matchNumber);
    const redTeam = result?.redTeam ?? match.redTeam;
    const blueTeam = result?.blueTeam ?? match.blueTeam;
    const redScore = result?.redScore ?? null;
    const blueScore = result?.blueScore ?? null;
    rows.push({
      matchType,
      matchNumber: match.matchNumber,
      matchName: `${MATCH_NAME_PREFIX[matchType]}${match.matchNumber}`,
      roundNumber,
      fieldNumber,
      redTeam,
      redTeamName: toTeamName(redTeam, result?.redTeamName ?? ""),
      redSurrogate: result?.redSurrogate ?? match.redSurrogate,
      redScore,
      blueTeam,
      blueTeamName: toTeamName(blueTeam, result?.blueTeamName ?? ""),
      blueSurrogate: result?.blueSurrogate ?? match.blueSurrogate,
      blueScore,
      startTime: match.startTime,
      state: toMatchState(redScore, blueScore),
    });
  }
  rows.sort((left, right) => left.matchNumber - right.matchNumber);
  return rows;
};
const readSettledValue = <T>(result: PromiseSettledResult<T>): T | null =>
  result.status === "fulfilled" ? result.value : null;
const readSettledError = (
  result: PromiseSettledResult<unknown>
): string | null => {
  if (result.status !== "rejected") {
    return null;
  }
  if (result.reason instanceof Error) {
    return result.reason.message;
  }
  return "Unknown request error.";
};

const toActiveScheduleType = (
  practiceSchedule: ScheduleResponse | null,
  qualificationSchedule: ScheduleResponse | null,
  availableMatchTypes: ControlMatchType[]
): ControlMatchType | null => {
  if (practiceSchedule?.isActive) {
    return "practice";
  }
  if (qualificationSchedule?.isActive) {
    return "quals";
  }
  return availableMatchTypes[0] ?? null;
};

export const fetchMatchControlData = async (
  eventCode: string,
  token: string
): Promise<MatchControlData> => {
  const [
    practiceScheduleResult,
    qualificationScheduleResult,
    practiceResultsResult,
    qualificationResultsResult,
  ] = await Promise.allSettled([
    fetchPracticeSchedule(eventCode, token),
    fetchQualificationSchedule(eventCode, token),
    fetchMatchResults(eventCode, "practice", token),
    fetchMatchResults(eventCode, "quals", token),
  ]);

  const practiceSchedule = readSettledValue(practiceScheduleResult);
  const qualificationSchedule = readSettledValue(qualificationScheduleResult);
  if (!(practiceSchedule || qualificationSchedule)) {
    throw new Error(
      "Failed to load both practice and qualification schedules."
    );
  }
  const warnings: string[] = [];
  const practiceScheduleError = readSettledError(practiceScheduleResult);
  if (practiceScheduleError) {
    warnings.push(`Practice schedule unavailable: ${practiceScheduleError}`);
  }
  const qualificationScheduleError = readSettledError(
    qualificationScheduleResult
  );
  if (qualificationScheduleError) {
    warnings.push(
      `Qualification schedule unavailable: ${qualificationScheduleError}`
    );
  }

  const practiceResultsError = readSettledError(practiceResultsResult);
  if (practiceResultsError) {
    warnings.push(`Practice results unavailable: ${practiceResultsError}`);
  }
  const qualificationResultsError = readSettledError(
    qualificationResultsResult
  );
  if (qualificationResultsError) {
    warnings.push(
      `Qualification results unavailable: ${qualificationResultsError}`
    );
  }

  const practiceResults = readSettledValue(practiceResultsResult) ?? [];
  const qualificationResults =
    readSettledValue(qualificationResultsResult) ?? [];
  const rowsByType = createEmptyRowsByType();
  const availableMatchTypes: ControlMatchType[] = [];
  if (practiceSchedule) {
    rowsByType.practice = toControlRows(
      "practice",
      practiceSchedule,
      toResultByMatchNumber(practiceResults)
    );
    availableMatchTypes.push("practice");
  }
  if (qualificationSchedule) {
    rowsByType.quals = toControlRows(
      "quals",
      qualificationSchedule,
      toResultByMatchNumber(qualificationResults)
    );
    availableMatchTypes.push("quals");
  }
  availableMatchTypes.sort(
    (left, right) =>
      MATCH_TYPE_ORDER.indexOf(left) - MATCH_TYPE_ORDER.indexOf(right)
  );

  return {
    availableMatchTypes,
    byType: rowsByType,
    activeScheduleType: toActiveScheduleType(
      practiceSchedule,
      qualificationSchedule,
      availableMatchTypes
    ),
    warnings,
  };
};
