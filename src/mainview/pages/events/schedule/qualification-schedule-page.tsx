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
} from "../../../features/events/services/schedule/qualification-schedule-service";
import { OneVsOneScheduleView } from "./components/one-vs-one-schedule-view";
import {
  buildMatchesCsvFileContent,
  type OneVsOneCsvMatch,
  parseMatchesFromCsvText,
} from "./components/schedule-csv";
import { ScheduleCsvSection } from "./components/schedule-csv-section";
import { ScheduleManagementToolbar } from "./components/schedule-management-toolbar";
import type { ScheduleMatchRow } from "./components/schedule-match-table";
import { EMPTY_ONE_VS_ONE_SCHEDULE_METRICS } from "./components/schedule-metrics";
import {
  buildOneVsOneMetricItems,
  buildOneVsOneSummaryItems,
} from "./components/schedule-overview";
import { ScheduleOverviewSection } from "./components/schedule-overview-section";
import type { MatchBlockState } from "./components/schedule-utils";
import {
  getFirstBlockStartTime,
  type OneVsOneGenerateResult,
  type OneVsOneLoadResult,
  useOneVsOneScheduleController,
} from "./components/use-one-vs-one-schedule-controller";

interface QualificationSchedulePageProps {
  eventCode: string;
  token: string | null;
}

const DEFAULT_CYCLE_MINUTES = 4;
const DEFAULT_FIELD_START_OFFSET_SECONDS = 15;

type SetMessage = (message: string | null) => void;

interface QualificationState {
  fieldStartOffsetSeconds: number;
  isClearing: boolean;
  isImporting: boolean;
  isUpdatingActivation: boolean;
  schedule: QualificationScheduleResponse | null;
}

type QualificationAction =
  | { type: "SET_FIELD_START_OFFSET"; payload: number }
  | { type: "SET_CLEARING"; payload: boolean }
  | { type: "SET_IMPORTING"; payload: boolean }
  | { type: "SET_UPDATING_ACTIVATION"; payload: boolean }
  | { type: "SET_SCHEDULE"; payload: QualificationScheduleResponse | null };

const initialState: QualificationState = {
  fieldStartOffsetSeconds: DEFAULT_FIELD_START_OFFSET_SECONDS,
  isClearing: false,
  isImporting: false,
  isUpdatingActivation: false,
  schedule: null,
};

const qualificationReducer = (
  state: QualificationState,
  action: QualificationAction
): QualificationState => {
  switch (action.type) {
    case "SET_FIELD_START_OFFSET":
      return { ...state, fieldStartOffsetSeconds: action.payload };
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
  schedule: QualificationScheduleResponse
): ScheduleMatchRow[] =>
  schedule.matches.map((match) => ({
    matchNumber: match.matchNumber,
    startTime: match.startTime,
    matchLabel: `Quals ${match.matchNumber}`,
    fieldNumber:
      ((match.matchNumber - 1) % (schedule.config.fieldCount || 1)) + 1,
    redTeam: match.redTeam,
    redSurrogate: match.redSurrogate,
    blueTeam: match.blueTeam,
    blueSurrogate: match.blueSurrogate,
  }));

const computeQualificationTeamCount = (
  schedule: QualificationScheduleResponse
): number =>
  schedule.config.matchesPerTeam
    ? Math.ceil(
        (schedule.matches.length * 2) / (schedule.config.matchesPerTeam || 1)
      )
    : 0;

const resolveQualificationScheduleTiming = ({
  fieldStartOffsetSeconds,
  matchBlocks,
  scheduleDate,
  setErrorMessage,
}: {
  fieldStartOffsetSeconds: number;
  matchBlocks: MatchBlockState[];
  scheduleDate: string;
  setErrorMessage: SetMessage;
}): {
  cycleTimeSeconds: number;
  fieldStartOffsetSeconds: number;
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
    fieldStartOffsetSeconds,
  };
};

interface QualificationFieldStartOffsetControlProps {
  fieldStartOffsetSeconds: number;
  onChange: (value: number) => void;
}

const QualificationFieldStartOffsetControl = ({
  fieldStartOffsetSeconds,
  onChange,
}: QualificationFieldStartOffsetControlProps): JSX.Element => (
  <label className="schedule-overview-field">
    <span>Field Start Offset (sec)</span>
    <input
      min={0}
      onChange={(event) =>
        onChange(Math.max(0, Number.parseInt(event.target.value, 10) || 0))
      }
      type="number"
      value={fieldStartOffsetSeconds}
    />
  </label>
);

interface CreateQualificationScheduleActionHandlersArgs {
  dispatch: (action: QualificationAction) => void;
  eventCode: string;
  fieldStartOffsetSeconds: number;
  fileInputRef: RefObject<HTMLInputElement>;
  hasMatches: boolean;
  isActive: boolean;
  matchBlocks: MatchBlockState[];
  schedule: QualificationScheduleResponse | null;
  scheduleDate: string;
  setErrorMessage: SetMessage;
  setSuccessMessage: SetMessage;
  setTeamCount: (value: number) => void;
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
  fieldStartOffsetSeconds,
  fileInputRef,
  hasMatches,
  isActive,
  matchBlocks,
  schedule,
  scheduleDate,
  setErrorMessage,
  setSuccessMessage,
  setTeamCount,
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
      fieldStartOffsetSeconds,
      matchBlocks,
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
      dispatch({ type: "SET_SCHEDULE", payload: result });
      setTeamCount(computeQualificationTeamCount(result));
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
      schedule ? mapQualsToMatchRows(schedule) : []
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
      dispatch({ type: "SET_SCHEDULE", payload: refreshed });
      setTeamCount(computeQualificationTeamCount(refreshed));
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
      dispatch({ type: "SET_SCHEDULE", payload: result });
      setTeamCount(computeQualificationTeamCount(result));
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

  const loadQualification = useCallback(
    async (
      currentEventCode: string,
      currentToken: string
    ): Promise<OneVsOneLoadResult<QualificationScheduleResponse>> => {
      const response = await fetchQualificationSchedule(
        currentEventCode,
        currentToken
      );
      return {
        config: response.config,
        matchCount: response.matches.length,
        schedule: response,
        teamCount: computeQualificationTeamCount(response),
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
        fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
      };
    },
    [state.fieldStartOffsetSeconds]
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
        teamCount: computeQualificationTeamCount(generated),
      };
    },
    []
  );

  const handleLoadedSchedule = useCallback(
    (result: OneVsOneLoadResult<QualificationScheduleResponse>): void => {
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
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
      dispatch({ type: "SET_SCHEDULE", payload: result.schedule });
    },
    []
  );

  const {
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
    setTeamCount,
    successMessage,
    teamCount,
  } = useOneVsOneScheduleController<
    QualificationScheduleResponse,
    GenerateQualificationSchedulePayload
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
  const matchesPerTeam = state.schedule?.config.matchesPerTeam ?? 0;
  const totalMatchesRequired = Math.ceil((teamCount * matchesPerTeam) / 2);
  const cycleTimeSeconds =
    state.schedule?.config.cycleTimeSeconds ??
    (matchBlocks[0]?.cycleTimeMinutes ?? DEFAULT_CYCLE_MINUTES) * 60;

  const summaryItems = buildOneVsOneSummaryItems({
    cycleTimeSeconds,
    fieldCount: state.schedule?.config.fieldCount ?? 0,
    fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
    generatedMatchCount: state.schedule?.matches.length ?? 0,
    isActive,
    matchesPerTeam,
    teamCount,
    totalMatchesRequired,
  });
  const metricItems = buildOneVsOneMetricItems(
    state.schedule?.metrics ?? EMPTY_ONE_VS_ONE_SCHEDULE_METRICS
  );

  const actionHandlers = createQualificationScheduleActionHandlers({
    dispatch,
    eventCode,
    fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
    fileInputRef,
    hasMatches,
    isActive,
    matchBlocks,
    schedule: state.schedule,
    scheduleDate,
    setErrorMessage,
    setSuccessMessage,
    setTeamCount,
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
        <ScheduleOverviewSection
          controls={
            <QualificationFieldStartOffsetControl
              fieldStartOffsetSeconds={state.fieldStartOffsetSeconds}
              onChange={(value) =>
                dispatch({
                  type: "SET_FIELD_START_OFFSET",
                  payload: value,
                })
              }
            />
          }
          metricItems={metricItems}
          summaryItems={summaryItems}
        />
      }
      defaultCycleTimeMinutes={DEFAULT_CYCLE_MINUTES}
      errorMessage={errorMessage}
      eventCode={eventCode}
      generatedEmptyMessage="No qualification matches available."
      generatedMatches={
        state.schedule ? mapQualsToMatchRows(state.schedule) : []
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
