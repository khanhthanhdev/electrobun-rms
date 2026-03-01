import { type RefObject, useCallback, useReducer, useRef } from "react";
import {
  clearQualificationSchedule,
  fetchQualificationSchedule,
  type GenerateQualificationSchedulePayload,
  generateQualificationSchedule,
  type QualificationScheduleResponse,
  type SaveQualificationSchedulePayload,
  saveQualificationSchedule,
  setQualificationScheduleActivation,
} from "@/features/events/schedule";
import { type EventTeamItem, fetchEventTeams } from "@/features/events/teams";
import {
  buildMatchesCsvFileContent,
  type OneVsOneCsvMatch,
  parseMatchesFromCsvText,
} from "@/widgets/schedule/schedule-csv";
import { ScheduleCsvSection } from "@/widgets/schedule/schedule-csv-section";
import { ScheduleManagementToolbar } from "@/widgets/schedule/schedule-management-toolbar";
import type { ScheduleMatchRow } from "@/widgets/schedule/schedule-match-table";
import { EMPTY_ONE_VS_ONE_SCHEDULE_METRICS } from "@/widgets/schedule/schedule-metrics";
import { OneVsOneScheduleOverview } from "@/widgets/schedule/schedule-overview-section";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import {
  getFirstBlockStartTime,
  type OneVsOneGenerateResult,
  type OneVsOneLoadResult,
  useOneVsOneScheduleController,
} from "@/widgets/schedule/use-one-vs-one-schedule-controller";
import { OneVsOneScheduleView } from "./components/one-vs-one-schedule-view";

interface QualificationSchedulePageProps {
  eventCode: string;
  token: string | null;
}

const DEFAULT_CYCLE_MINUTES = 4;
const DEFAULT_FIELD_COUNT = 1;
const DEFAULT_FIELD_START_OFFSET_SECONDS = 15;
const DEFAULT_MATCHES_PER_TEAM = 6;

type TeamNamesByNumber = Record<number, string>;
type SetMessage = (message: string | null) => void;

const buildTeamNamesByNumber = (teams: EventTeamItem[]): TeamNamesByNumber => {
  const namesByNumber: TeamNamesByNumber = {};
  for (const team of teams) {
    const trimmedName = team.teamName.trim();
    if (!trimmedName) {
      continue;
    }

    namesByNumber[team.teamNumber] = trimmedName;
  }

  return namesByNumber;
};

interface QualificationState {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  isClearing: boolean;
  isImporting: boolean;
  isUpdatingActivation: boolean;
  matchesPerTeam: number;
  schedule: QualificationScheduleResponse | null;
}

type QualificationAction =
  | { type: "SET_FIELD_COUNT"; payload: number }
  | { type: "SET_FIELD_START_OFFSET"; payload: number }
  | { type: "SET_MATCHES_PER_TEAM"; payload: number }
  | { type: "SET_CLEARING"; payload: boolean }
  | { type: "SET_IMPORTING"; payload: boolean }
  | { type: "SET_UPDATING_ACTIVATION"; payload: boolean }
  | { type: "SET_SCHEDULE"; payload: QualificationScheduleResponse | null };

const initialState: QualificationState = {
  fieldCount: DEFAULT_FIELD_COUNT,
  fieldStartOffsetSeconds: DEFAULT_FIELD_START_OFFSET_SECONDS,
  isClearing: false,
  isImporting: false,
  isUpdatingActivation: false,
  matchesPerTeam: DEFAULT_MATCHES_PER_TEAM,
  schedule: null,
};

const qualificationReducer = (
  state: QualificationState,
  action: QualificationAction
): QualificationState => {
  switch (action.type) {
    case "SET_FIELD_COUNT":
      return { ...state, fieldCount: Math.max(1, action.payload) };
    case "SET_FIELD_START_OFFSET":
      return { ...state, fieldStartOffsetSeconds: Math.max(0, action.payload) };
    case "SET_MATCHES_PER_TEAM":
      return { ...state, matchesPerTeam: Math.max(1, action.payload) };
    case "SET_CLEARING":
      return { ...state, isClearing: action.payload };
    case "SET_IMPORTING":
      return { ...state, isImporting: action.payload };
    case "SET_UPDATING_ACTIVATION":
      return { ...state, isUpdatingActivation: action.payload };
    case "SET_SCHEDULE":
      return { ...state, schedule: action.payload };
    default:
      return state;
  }
};

const mapCsvMatchesToQualificationMatches = (
  matches: OneVsOneCsvMatch[]
): SaveQualificationSchedulePayload["matches"] =>
  matches.map((match) => ({
    matchNumber: match.matchNumber,
    redTeam: match.redTeam,
    blueTeam: match.blueTeam,
    redSurrogate: match.redSurrogate,
    blueSurrogate: match.blueSurrogate,
  }));

const mapQualsToMatchRows = (
  schedule: QualificationScheduleResponse,
  fieldStartOffsetSeconds: number,
  fieldCount: number,
  teamNamesByNumber: TeamNamesByNumber
): ScheduleMatchRow[] => {
  const safeFieldCount = Math.max(1, fieldCount);
  const cycleTimeMs = schedule.config.cycleTimeSeconds * 1000;
  const fieldOffsetMs = fieldStartOffsetSeconds * 1000;
  const baseStartTime =
    schedule.config.startTime ?? schedule.matches[0]?.startTime ?? Date.now();

  return schedule.matches.map((match, index) => {
    const roundIndex = Math.floor(index / safeFieldCount);
    const fieldIndex = index % safeFieldCount;
    const startTime =
      baseStartTime + roundIndex * cycleTimeMs + fieldIndex * fieldOffsetMs;

    return {
      matchNumber: match.matchNumber,
      startTime,
      matchLabel: `Quals ${match.matchNumber}`,
      fieldNumber: (index % safeFieldCount) + 1,
      redTeam: match.redTeam,
      redTeamName: match.redTeamName ?? teamNamesByNumber[match.redTeam],
      redSurrogate: match.redSurrogate,
      blueTeam: match.blueTeam,
      blueTeamName: match.blueTeamName ?? teamNamesByNumber[match.blueTeam],
      blueSurrogate: match.blueSurrogate,
    };
  });
};

const computeQualificationTeamCount = (
  schedule: QualificationScheduleResponse
): number =>
  schedule.config.matchesPerTeam
    ? Math.ceil(
        (schedule.matches.length * 2) / (schedule.config.matchesPerTeam || 1)
      )
    : 0;

const resolveQualificationScheduleTiming = ({
  fieldCount,
  fieldStartOffsetSeconds,
  matchBlocks,
  matchesPerTeam,
  scheduleDate,
  setErrorMessage,
}: {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchBlocks: MatchBlockState[];
  matchesPerTeam: number;
  scheduleDate: string;
  setErrorMessage: SetMessage;
}): {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  matchesPerTeam: number;
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
    fieldCount,
    fieldStartOffsetSeconds,
    matchesPerTeam,
  };
};

interface CreateQualificationScheduleActionHandlersArgs {
  dispatch: (action: QualificationAction) => void;
  eventCode: string;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  fileInputRef: RefObject<HTMLInputElement>;
  hasMatches: boolean;
  isActive: boolean;
  matchBlocks: MatchBlockState[];
  matchesPerTeam: number;
  schedule: QualificationScheduleResponse | null;
  scheduleDate: string;
  setErrorMessage: SetMessage;
  setSuccessMessage: SetMessage;
  teamNamesByNumber: TeamNamesByNumber;
  token: string | null;
}

interface QualificationScheduleActionHandlers {
  handleClearClick: () => void;
  handleExportCsv: () => void;
  handleImportCsvClick: () => void;
  handleToggleActivationClick: () => void;
}

const createQualificationScheduleActionHandlers = ({
  dispatch,
  eventCode,
  fieldCount,
  fieldStartOffsetSeconds,
  fileInputRef,
  hasMatches,
  isActive,
  matchBlocks,
  matchesPerTeam,
  schedule,
  scheduleDate,
  setErrorMessage,
  setSuccessMessage,
  teamNamesByNumber,
  token,
}: CreateQualificationScheduleActionHandlersArgs): QualificationScheduleActionHandlers => {
  const handleImportCsv = async (): Promise<void> => {
    if (!token) {
      setErrorMessage(
        "You must be logged in to import qualification schedule."
      );
      return;
    }

    if (!fileInputRef.current?.files?.length) {
      setErrorMessage("No file selected.");
      return;
    }

    const timing = resolveQualificationScheduleTiming({
      fieldCount,
      fieldStartOffsetSeconds,
      matchBlocks,
      matchesPerTeam,
      scheduleDate,
      setErrorMessage,
    });
    if (!timing) {
      return;
    }

    const file = fileInputRef.current.files[0];
    const text = await file.text();

    dispatch({ type: "SET_IMPORTING", payload: true });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const importedMatches = parseMatchesFromCsvText(text);
      const result = await saveQualificationSchedule(
        eventCode,
        {
          startTime: timing.startTime,
          cycleTimeSeconds: timing.cycleTimeSeconds,
          fieldCount: timing.fieldCount,
          fieldStartOffsetSeconds: timing.fieldStartOffsetSeconds,
          matches: mapCsvMatchesToQualificationMatches(importedMatches),
        },
        token
      );

      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({
        type: "SET_FIELD_COUNT",
        payload: result.config.fieldCount ?? DEFAULT_FIELD_COUNT,
      });
      dispatch({
        type: "SET_MATCHES_PER_TEAM",
        payload: result.config.matchesPerTeam ?? DEFAULT_MATCHES_PER_TEAM,
      });
      dispatch({ type: "SET_SCHEDULE", payload: result });
      setSuccessMessage(
        `Imported and saved ${importedMatches.length} qualification matches.`
      );
      fileInputRef.current.value = "";
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import CSV."
      );
    } finally {
      dispatch({ type: "SET_IMPORTING", payload: false });
    }
  };

  const handleExportCsv = (): void => {
    const csvContent = buildMatchesCsvFileContent(
      schedule
        ? mapQualsToMatchRows(
            schedule,
            fieldStartOffsetSeconds,
            fieldCount,
            teamNamesByNumber
          )
        : []
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const linkElement = document.createElement("a");
    linkElement.href = objectUrl;
    linkElement.download = `${eventCode}-qualification-matches.csv`;
    linkElement.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleClear = async (): Promise<void> => {
    if (!token) {
      setErrorMessage("You must be logged in to clear qualification schedule.");
      return;
    }

    dispatch({ type: "SET_CLEARING", payload: true });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await clearQualificationSchedule(eventCode, token);
      const refreshed = await fetchQualificationSchedule(eventCode, token);
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          refreshed.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({
        type: "SET_FIELD_COUNT",
        payload: refreshed.config.fieldCount ?? DEFAULT_FIELD_COUNT,
      });
      dispatch({
        type: "SET_MATCHES_PER_TEAM",
        payload: refreshed.config.matchesPerTeam ?? DEFAULT_MATCHES_PER_TEAM,
      });
      dispatch({ type: "SET_SCHEDULE", payload: refreshed });
      setSuccessMessage("Qualification schedule cleared.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to clear qualification schedule."
      );
    } finally {
      dispatch({ type: "SET_CLEARING", payload: false });
    }
  };

  const handleToggleActivation = async (): Promise<void> => {
    if (!token) {
      setErrorMessage(
        "You must be logged in to update qualification schedule activation."
      );
      return;
    }

    if (!(hasMatches || isActive)) {
      setErrorMessage("Generate or import matches before activating schedule.");
      return;
    }

    dispatch({ type: "SET_UPDATING_ACTIVATION", payload: true });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await setQualificationScheduleActivation(
        eventCode,
        !isActive,
        token
      );
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({
        type: "SET_FIELD_COUNT",
        payload: result.config.fieldCount ?? DEFAULT_FIELD_COUNT,
      });
      dispatch({
        type: "SET_MATCHES_PER_TEAM",
        payload: result.config.matchesPerTeam ?? DEFAULT_MATCHES_PER_TEAM,
      });
      dispatch({ type: "SET_SCHEDULE", payload: result });
      setSuccessMessage(
        result.isActive
          ? "Qualification schedule activated."
          : "Qualification schedule deactivated."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update schedule activation."
      );
    } finally {
      dispatch({ type: "SET_UPDATING_ACTIVATION", payload: false });
    }
  };

  return {
    handleClearClick: () => {
      handleClear().catch(() => undefined);
    },
    handleExportCsv,
    handleImportCsvClick: () => {
      handleImportCsv().catch(() => undefined);
    },
    handleToggleActivationClick: () => {
      handleToggleActivation().catch(() => undefined);
    },
  };
};

export const QualificationSchedulePage = ({
  eventCode,
  token,
}: QualificationSchedulePageProps): JSX.Element => {
  const [state, dispatch] = useReducer(qualificationReducer, initialState);

  const fileInputRef = useRef<HTMLInputElement>(null);

  interface QualificationLoadContext {
    teamNamesByNumber: TeamNamesByNumber;
  }

  const loadQualification = useCallback(
    async (
      currentEventCode: string,
      currentToken: string
    ): Promise<
      OneVsOneLoadResult<
        QualificationScheduleResponse,
        QualificationLoadContext
      >
    > => {
      const [response, teamsResponse] = await Promise.all([
        fetchQualificationSchedule(currentEventCode, currentToken),
        fetchEventTeams(currentEventCode, currentToken, "").catch(() => ({
          teams: [] as EventTeamItem[],
        })),
      ]);

      const teamCountFromTeams = teamsResponse.teams.length;
      const teamCount =
        teamCountFromTeams > 0
          ? teamCountFromTeams
          : computeQualificationTeamCount(response);

      return {
        config: response.config,
        context: {
          teamNamesByNumber: buildTeamNamesByNumber(teamsResponse.teams),
        },
        matchCount: response.matches.length,
        schedule: response,
        teamCount,
      };
    },
    []
  );

  const buildGeneratePayload = useCallback(
    ({
      matchBlocks,
      scheduleDate,
    }: {
      matchBlocks: MatchBlockState[];
      scheduleDate: string;
    }): GenerateQualificationSchedulePayload => {
      const startTime = getFirstBlockStartTime(scheduleDate, matchBlocks);
      const firstBlock = matchBlocks[0];
      if (!firstBlock) {
        throw new Error("You must have at least one match block.");
      }

      return {
        startTime,
        cycleTimeSeconds: firstBlock.cycleTimeMinutes * 60,
        fieldCount: state.fieldCount,
        fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
        matchesPerTeam: state.matchesPerTeam,
      };
    },
    [state.fieldCount, state.fieldStartOffsetSeconds, state.matchesPerTeam]
  );

  const generateQualification = useCallback(
    async (
      currentEventCode: string,
      payload: GenerateQualificationSchedulePayload,
      currentToken: string
    ): Promise<OneVsOneGenerateResult<QualificationScheduleResponse>> => {
      const generated = await generateQualificationSchedule(
        currentEventCode,
        payload,
        currentToken
      );

      return {
        config: generated.config,
        matchCount: generated.matches.length,
        schedule: generated,
        successMessage: `Generated ${generated.matches.length} qualification matches (1v1).`,
      };
    },
    []
  );

  const handleLoadedSchedule = useCallback(
    (
      result: OneVsOneLoadResult<
        QualificationScheduleResponse,
        QualificationLoadContext
      >
    ): void => {
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({
        type: "SET_FIELD_COUNT",
        payload: result.schedule.config.fieldCount ?? DEFAULT_FIELD_COUNT,
      });
      dispatch({
        type: "SET_MATCHES_PER_TEAM",
        payload:
          result.schedule.config.matchesPerTeam ?? DEFAULT_MATCHES_PER_TEAM,
      });
      dispatch({ type: "SET_SCHEDULE", payload: result.schedule });
    },
    []
  );

  const handleGeneratedSchedule = useCallback(
    (result: OneVsOneGenerateResult<QualificationScheduleResponse>): void => {
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({
        type: "SET_FIELD_COUNT",
        payload: result.schedule.config.fieldCount ?? DEFAULT_FIELD_COUNT,
      });
      dispatch({
        type: "SET_MATCHES_PER_TEAM",
        payload:
          result.schedule.config.matchesPerTeam ?? DEFAULT_MATCHES_PER_TEAM,
      });
      dispatch({ type: "SET_SCHEDULE", payload: result.schedule });
    },
    []
  );

  const {
    context,
    errorMessage,
    handleGenerate,
    isGenerating,
    isLoading,
    matchBlocks,
    scheduleDate,
    setErrorMessage,
    setMatchBlocks,
    setScheduleDate,
    setSuccessMessage,
    successMessage,
    teamCount,
  } = useOneVsOneScheduleController<
    QualificationScheduleResponse,
    GenerateQualificationSchedulePayload,
    QualificationLoadContext
  >({
    buildGeneratePayload,
    defaultCycleMinutes: DEFAULT_CYCLE_MINUTES,
    eventCode,
    generateErrorMessage: "Failed to generate qualification schedule.",
    generateSchedule: generateQualification,
    loadErrorMessage: "Failed to load qualification schedule.",
    loadSchedule: loadQualification,
    missingGenerateTokenMessage:
      "You must be logged in to generate qualification schedule.",
    missingLoadTokenMessage:
      "You must be logged in to manage qualification schedule.",
    onGenerated: handleGeneratedSchedule,
    onLoaded: handleLoadedSchedule,
    token,
  });

  const hasMatches = (state.schedule?.matches.length ?? 0) > 0;
  const isActive = state.schedule?.isActive ?? false;
  const matchesPerTeam = state.matchesPerTeam;
  const totalMatchesRequired = Math.ceil((teamCount * matchesPerTeam) / 2);
  const cycleTimeSeconds =
    state.schedule?.config.cycleTimeSeconds ??
    (matchBlocks[0]?.cycleTimeMinutes ?? DEFAULT_CYCLE_MINUTES) * 60;

  const handleCycleTimeChange = useCallback(
    (seconds: number) => {
      const minutes = Math.max(1, seconds) / 60;
      setMatchBlocks((prev) =>
        prev.map((block) => ({ ...block, cycleTimeMinutes: minutes }))
      );
    },
    [setMatchBlocks]
  );

  const metrics = state.schedule?.metrics ?? EMPTY_ONE_VS_ONE_SCHEDULE_METRICS;

  const actionHandlers = createQualificationScheduleActionHandlers({
    dispatch,
    eventCode,
    fieldCount: state.fieldCount,
    fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
    fileInputRef,
    hasMatches,
    isActive,
    matchBlocks,
    matchesPerTeam: state.matchesPerTeam,
    schedule: state.schedule,
    scheduleDate,
    setErrorMessage,
    setSuccessMessage,
    teamNamesByNumber: context?.teamNamesByNumber ?? {},
    token,
  });

  return (
    <OneVsOneScheduleView
      beforeGeneratedSection={
        <ScheduleCsvSection
          description="The qualification schedule can be imported from CSV using the same one-vs-one format as practice."
          fileInputRef={fileInputRef}
          hasMatches={hasMatches}
          importDisabled={state.isImporting}
          onExport={actionHandlers.handleExportCsv}
          onImport={actionHandlers.handleImportCsvClick}
        />
      }
      configSection={
        <OneVsOneScheduleOverview
          cycleTimeSeconds={cycleTimeSeconds}
          editable={{
            matchesPerTeam: {
              min: 1,
              onChange: (v) =>
                dispatch({ type: "SET_MATCHES_PER_TEAM", payload: v }),
            },
            fieldCount: {
              min: 1,
              onChange: (v) =>
                dispatch({ type: "SET_FIELD_COUNT", payload: v }),
            },
            cycleTimeSeconds: { min: 1, onChange: handleCycleTimeChange },
            fieldStartOffsetSeconds: {
              min: 0,
              onChange: (v) =>
                dispatch({ type: "SET_FIELD_START_OFFSET", payload: v }),
            },
          }}
          fieldCount={state.fieldCount}
          fieldStartOffsetSeconds={state.fieldStartOffsetSeconds}
          generatedMatchCount={state.schedule?.matches.length ?? 0}
          isActive={isActive}
          matchesPerTeam={matchesPerTeam}
          metrics={metrics}
          teamCount={teamCount}
          totalMatchesRequired={totalMatchesRequired}
        />
      }
      defaultCycleTimeMinutes={DEFAULT_CYCLE_MINUTES}
      errorMessage={errorMessage}
      eventCode={eventCode}
      fieldCount={state.fieldCount}
      fieldStartOffsetSeconds={state.fieldStartOffsetSeconds}
      generatedEmptyMessage="No qualification matches available."
      generatedMatches={
        state.schedule
          ? mapQualsToMatchRows(
              state.schedule,
              state.fieldStartOffsetSeconds,
              state.fieldCount,
              context?.teamNamesByNumber ?? {}
            )
          : []
      }
      hasMatches={hasMatches}
      isLoading={isLoading}
      matchBlocks={matchBlocks}
      onMatchBlocksChange={setMatchBlocks}
      onScheduleDateChange={setScheduleDate}
      scheduleDate={scheduleDate}
      successMessage={successMessage}
      teamCount={teamCount}
      title="Qualification Match Schedule"
      toolbar={() => (
        <ScheduleManagementToolbar
          hasMatches={hasMatches}
          isActive={isActive}
          isClearing={state.isClearing}
          isGenerating={isGenerating}
          isUpdatingActivation={state.isUpdatingActivation}
          onClear={actionHandlers.handleClearClick}
          onGenerate={handleGenerate}
          onToggleActivation={actionHandlers.handleToggleActivationClick}
        />
      )}
    />
  );
};
