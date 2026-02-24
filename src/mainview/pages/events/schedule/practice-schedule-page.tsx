import {
  type RefObject,
  useCallback,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  type EventTeamItem,
  fetchEventTeams,
} from "../../../features/events/services/event-teams-service";
import {
  clearPracticeSchedule,
  fetchPracticeSchedule,
  type GeneratePracticeSchedulePayload,
  generatePracticeSchedule,
  type PracticeScheduleResponse,
  printPracticeScheduleResults,
  type SavePracticeSchedulePayload,
  savePracticeSchedule,
  setPracticeScheduleActivation,
} from "../../../features/events/services/schedule/practice-schedule-service";
import type { PrintDestination } from "../../../shared/services/print-service";
import { OneVsOneScheduleView } from "./components/one-vs-one-schedule-view";
import {
  buildMatchesCsvFileContent,
  type OneVsOneCsvMatch,
  parseMatchesFromCsvText,
} from "./components/schedule-csv";
import { ScheduleCsvSection } from "./components/schedule-csv-section";
import { ScheduleManagementToolbar } from "./components/schedule-management-toolbar";
import type { ScheduleMatchRow } from "./components/schedule-match-table";
import { computeOneVsOneScheduleMetrics } from "./components/schedule-metrics";
import { OneVsOneScheduleOverview } from "./components/schedule-overview-section";
import type { MatchBlockState } from "./components/schedule-utils";
import {
  getFirstBlockStartTime,
  type OneVsOneGenerateResult,
  type OneVsOneLoadResult,
  useOneVsOneScheduleController,
} from "./components/use-one-vs-one-schedule-controller";

interface PracticeSchedulePageProps {
  eventCode: string;
  token: string | null;
}

const DEFAULT_CYCLE_MINUTES = 7;
const DEFAULT_FIELD_START_OFFSET_SECONDS = 0;

type TeamNamesByNumber = Record<number, string>;
type EditablePracticeMatch = SavePracticeSchedulePayload["matches"][number] & {
  blueTeamName?: string;
  redTeamName?: string;
};
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

interface PracticeState {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  isActive: boolean;
  isClearing: boolean;
  isImporting: boolean;
  isUpdatingActivation: boolean;
  matches: EditablePracticeMatch[];
  maxFieldCount: number;
}

type PracticeAction =
  | { type: "SET_FIELD_COUNT"; payload: number }
  | { type: "SET_FIELD_START_OFFSET"; payload: number }
  | { type: "SET_IS_ACTIVE"; payload: boolean }
  | { type: "SET_IS_CLEARING"; payload: boolean }
  | { type: "SET_IS_IMPORTING"; payload: boolean }
  | { type: "SET_IS_UPDATING_ACTIVATION"; payload: boolean }
  | { type: "SET_MATCHES"; payload: EditablePracticeMatch[] }
  | { type: "SET_MAX_FIELD_COUNT"; payload: number };

const initialPracticeState: PracticeState = {
  fieldCount: 1,
  fieldStartOffsetSeconds: 0,
  isActive: false,
  isClearing: false,
  isImporting: false,
  isUpdatingActivation: false,
  matches: [],
  maxFieldCount: 1,
};

const practiceReducer = (
  state: PracticeState,
  action: PracticeAction
): PracticeState => {
  switch (action.type) {
    case "SET_FIELD_COUNT":
      return {
        ...state,
        fieldCount: Math.min(Math.max(1, action.payload), state.maxFieldCount),
      };
    case "SET_FIELD_START_OFFSET":
      return { ...state, fieldStartOffsetSeconds: Math.max(0, action.payload) };
    case "SET_IS_ACTIVE":
      return { ...state, isActive: action.payload };
    case "SET_IS_CLEARING":
      return { ...state, isClearing: action.payload };
    case "SET_IS_IMPORTING":
      return { ...state, isImporting: action.payload };
    case "SET_IS_UPDATING_ACTIVATION":
      return { ...state, isUpdatingActivation: action.payload };
    case "SET_MATCHES":
      return { ...state, matches: action.payload };
    case "SET_MAX_FIELD_COUNT": {
      const maxFieldCount = Math.max(1, action.payload);
      return {
        ...state,
        maxFieldCount,
        fieldCount: Math.min(state.fieldCount, maxFieldCount),
      };
    }
    default:
      return state;
  }
};

const mapEditablePracticeMatch = (
  match: PracticeScheduleResponse["matches"][number]
): EditablePracticeMatch => ({
  matchNumber: match.matchNumber,
  redTeam: match.redTeam,
  redTeamName: match.redTeamName,
  blueTeam: match.blueTeam,
  blueTeamName: match.blueTeamName,
  redSurrogate: match.redSurrogate,
  blueSurrogate: match.blueSurrogate,
});

const mapPracticeMatches = (
  schedule: PracticeScheduleResponse
): EditablePracticeMatch[] =>
  schedule.matches.map((match) => mapEditablePracticeMatch(match));

const mapCsvMatchesToPracticeMatches = (
  matches: OneVsOneCsvMatch[]
): SavePracticeSchedulePayload["matches"] =>
  matches.map((match) => ({
    matchNumber: match.matchNumber,
    redTeam: match.redTeam,
    blueTeam: match.blueTeam,
    redSurrogate: match.redSurrogate,
    blueSurrogate: match.blueSurrogate,
  }));

const mapToMatchRow = (
  match: EditablePracticeMatch,
  startTime: number,
  fieldCount: number,
  teamNamesByNumber: TeamNamesByNumber
): ScheduleMatchRow => ({
  matchNumber: match.matchNumber,
  startTime,
  matchLabel: `Practice ${match.matchNumber}`,
  fieldNumber: ((match.matchNumber - 1) % fieldCount) + 1,
  redTeam: match.redTeam,
  redTeamName: match.redTeamName ?? teamNamesByNumber[match.redTeam],
  redSurrogate: match.redSurrogate ?? false,
  blueTeam: match.blueTeam,
  blueTeamName: match.blueTeamName ?? teamNamesByNumber[match.blueTeam],
  blueSurrogate: match.blueSurrogate ?? false,
});

const buildPracticeMatchRows = ({
  fieldCount,
  fieldStartOffsetSeconds,
  firstBlock,
  matches,
  scheduleDate,
  teamNamesByNumber,
}: {
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  firstBlock: MatchBlockState | undefined;
  matches: EditablePracticeMatch[];
  scheduleDate: string;
  teamNamesByNumber: TeamNamesByNumber;
}): ScheduleMatchRow[] =>
  matches.map((match, index) => {
    let computedStart = Date.now();

    if (firstBlock) {
      const blockDate = new Date(`${scheduleDate}T${firstBlock.startTimeText}`);
      if (Number.isNaN(blockDate.getTime())) {
        return mapToMatchRow(match, Date.now(), fieldCount, teamNamesByNumber);
      }
      const cycleTimeMs = firstBlock.cycleTimeMinutes * 60 * 1000;
      const fieldOffsetMs = fieldStartOffsetSeconds * 1000;
      const safeFieldCount = Math.max(1, fieldCount);
      const roundIndex = Math.floor(index / safeFieldCount);
      const fieldIndex = index % safeFieldCount;
      computedStart =
        blockDate.getTime() +
        roundIndex * cycleTimeMs +
        fieldIndex * fieldOffsetMs;
    }

    return mapToMatchRow(match, computedStart, fieldCount, teamNamesByNumber);
  });

const resolvePracticeScheduleTiming = ({
  matchBlocks,
  scheduleDate,
  setErrorMessage,
}: {
  matchBlocks: MatchBlockState[];
  scheduleDate: string;
  setErrorMessage: SetMessage;
}): {
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

interface CreatePracticeScheduleActionHandlersArgs {
  dispatch: (action: PracticeAction) => void;
  eventCode: string;
  exportRows: ScheduleMatchRow[];
  fileInputRef: RefObject<HTMLInputElement>;
  hasMatches: boolean;
  matchBlocks: MatchBlockState[];
  scheduleDate: string;
  setErrorMessage: SetMessage;
  setSuccessMessage: SetMessage;
  state: PracticeState;
  token: string | null;
}

interface PracticeScheduleActionHandlers {
  handleClearClick: () => void;
  handleExportCsv: () => void;
  handleImportCsvClick: () => void;
  handleToggleActivationClick: () => void;
}

const createPracticeScheduleActionHandlers = ({
  dispatch,
  eventCode,
  exportRows,
  fileInputRef,
  hasMatches,
  matchBlocks,
  scheduleDate,
  setErrorMessage,
  setSuccessMessage,
  state,
  token,
}: CreatePracticeScheduleActionHandlersArgs): PracticeScheduleActionHandlers => {
  const handleImportCsv = async (): Promise<void> => {
    if (!token) {
      setErrorMessage("You must be logged in to import practice schedule.");
      return;
    }

    if (!fileInputRef.current?.files?.length) {
      setErrorMessage("No file selected.");
      return;
    }

    const timing = resolvePracticeScheduleTiming({
      matchBlocks,
      scheduleDate,
      setErrorMessage,
    });
    if (!timing) {
      return;
    }

    const file = fileInputRef.current.files[0];
    const text = await file.text();

    dispatch({ type: "SET_IS_IMPORTING", payload: true });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const importedMatches = parseMatchesFromCsvText(text);
      const result = await savePracticeSchedule(
        eventCode,
        {
          startTime: timing.startTime,
          cycleTimeSeconds: timing.cycleTimeSeconds,
          matches: mapCsvMatchesToPracticeMatches(importedMatches),
        },
        token
      );

      const importedFieldCount = result.config.fieldCount || 1;
      dispatch({ type: "SET_MAX_FIELD_COUNT", payload: importedFieldCount });
      dispatch({ type: "SET_FIELD_COUNT", payload: importedFieldCount });
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({ type: "SET_IS_ACTIVE", payload: result.isActive });
      dispatch({
        type: "SET_MATCHES",
        payload: mapPracticeMatches(result),
      });
      setSuccessMessage(
        `Imported and saved ${importedMatches.length} practice matches.`
      );
      fileInputRef.current.value = "";
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to import CSV."
      );
    } finally {
      dispatch({ type: "SET_IS_IMPORTING", payload: false });
    }
  };

  const handleExportCsv = (): void => {
    const csvContent = buildMatchesCsvFileContent(exportRows);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const objectUrl = URL.createObjectURL(blob);
    const linkElement = document.createElement("a");
    linkElement.href = objectUrl;
    linkElement.download = `${eventCode}-practice-matches.csv`;
    linkElement.click();
    URL.revokeObjectURL(objectUrl);
  };

  const handleClear = async (): Promise<void> => {
    if (!token) {
      setErrorMessage("You must be logged in to clear practice schedule.");
      return;
    }

    dispatch({ type: "SET_IS_CLEARING", payload: true });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await clearPracticeSchedule(eventCode, token);
      const refreshed = await fetchPracticeSchedule(eventCode, token);
      const clearedFieldCount = refreshed.config.fieldCount || 1;
      dispatch({ type: "SET_MAX_FIELD_COUNT", payload: clearedFieldCount });
      dispatch({ type: "SET_FIELD_COUNT", payload: clearedFieldCount });
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          refreshed.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({ type: "SET_IS_ACTIVE", payload: refreshed.isActive });
      dispatch({
        type: "SET_MATCHES",
        payload: mapPracticeMatches(refreshed),
      });
      setSuccessMessage("Practice schedule cleared.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to clear practice schedule."
      );
    } finally {
      dispatch({ type: "SET_IS_CLEARING", payload: false });
    }
  };

  const handleToggleActivation = async (): Promise<void> => {
    if (!token) {
      setErrorMessage(
        "You must be logged in to update practice schedule activation."
      );
      return;
    }

    if (!(hasMatches || state.isActive)) {
      setErrorMessage("Generate or import matches before activating schedule.");
      return;
    }

    dispatch({ type: "SET_IS_UPDATING_ACTIVATION", payload: true });
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await setPracticeScheduleActivation(
        eventCode,
        !state.isActive,
        token
      );
      const activationFieldCount = result.config.fieldCount || 1;
      dispatch({ type: "SET_MAX_FIELD_COUNT", payload: activationFieldCount });
      dispatch({ type: "SET_FIELD_COUNT", payload: activationFieldCount });
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({ type: "SET_IS_ACTIVE", payload: result.isActive });
      dispatch({
        type: "SET_MATCHES",
        payload: mapPracticeMatches(result),
      });
      setSuccessMessage(
        result.isActive
          ? "Practice schedule activated."
          : "Practice schedule deactivated."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to update schedule activation."
      );
    } finally {
      dispatch({ type: "SET_IS_UPDATING_ACTIVATION", payload: false });
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

interface PracticeLoadContext {
  teamNamesByNumber: TeamNamesByNumber;
}

export const PracticeSchedulePage = ({
  eventCode,
  token,
}: PracticeSchedulePageProps): JSX.Element => {
  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState);
  const [matchesPerTeam, setMatchesPerTeam] = useState<number>(1);
  const [teamNamesByNumber, setTeamNamesByNumber] = useState<TeamNamesByNumber>(
    {}
  );

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoadedSchedule = useCallback(
    (
      result: OneVsOneLoadResult<PracticeScheduleResponse, PracticeLoadContext>
    ): void => {
      const serverFieldCount = result.schedule.config.fieldCount || 1;
      dispatch({ type: "SET_MAX_FIELD_COUNT", payload: serverFieldCount });
      dispatch({ type: "SET_FIELD_COUNT", payload: serverFieldCount });
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({ type: "SET_IS_ACTIVE", payload: result.schedule.isActive });
      dispatch({
        type: "SET_MATCHES",
        payload: mapPracticeMatches(result.schedule),
      });
      setTeamNamesByNumber(result.context?.teamNamesByNumber ?? {});
    },
    []
  );

  const handleGeneratedSchedule = useCallback(
    (result: OneVsOneGenerateResult<PracticeScheduleResponse>): void => {
      const serverFieldCount = result.schedule.config.fieldCount || 1;
      dispatch({ type: "SET_MAX_FIELD_COUNT", payload: serverFieldCount });
      dispatch({ type: "SET_FIELD_COUNT", payload: serverFieldCount });
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          result.schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({ type: "SET_IS_ACTIVE", payload: result.schedule.isActive });
      dispatch({
        type: "SET_MATCHES",
        payload: mapPracticeMatches(result.schedule),
      });
    },
    []
  );

  const loadPractice = useCallback(
    async (
      currentEventCode: string,
      currentToken: string
    ): Promise<
      OneVsOneLoadResult<PracticeScheduleResponse, PracticeLoadContext>
    > => {
      const [scheduleResponse, teamsResponse] = await Promise.all([
        fetchPracticeSchedule(currentEventCode, currentToken),
        fetchEventTeams(currentEventCode, currentToken, "").catch(() => ({
          teams: [] as EventTeamItem[],
        })),
      ]);

      return {
        config: scheduleResponse.config,
        context: {
          teamNamesByNumber: buildTeamNamesByNumber(teamsResponse.teams),
        },
        matchCount: scheduleResponse.matches.length,
        schedule: scheduleResponse,
        teamCount: teamsResponse.teams.length,
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
    }): GeneratePracticeSchedulePayload => ({
      fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
      matchesPerTeam,
      matchBlocks: matchBlocks.map((block) => {
        const startDate = new Date(`${scheduleDate}T${block.startTimeText}`);
        const endDate = new Date(`${scheduleDate}T${block.endTimeText}`);
        if (
          Number.isNaN(startDate.getTime()) ||
          Number.isNaN(endDate.getTime())
        ) {
          throw new Error("Invalid date/time in match block.");
        }
        return {
          startTime: startDate.getTime(),
          endTime: endDate.getTime(),
          cycleTimeSeconds: block.cycleTimeMinutes * 60,
        };
      }),
    }),
    [matchesPerTeam, state.fieldStartOffsetSeconds]
  );

  const generatePractice = useCallback(
    async (
      currentEventCode: string,
      payload: GeneratePracticeSchedulePayload,
      currentToken: string
    ): Promise<OneVsOneGenerateResult<PracticeScheduleResponse>> => {
      const result = await generatePracticeSchedule(
        currentEventCode,
        payload,
        currentToken
      );

      return {
        config: result.config,
        matchCount: result.matches.length,
        schedule: result,
        successMessage: `Generated ${result.matches.length} matches using MatchMaker algorithm.`,
      };
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
    successMessage,
    teamCount,
  } = useOneVsOneScheduleController<
    PracticeScheduleResponse,
    GeneratePracticeSchedulePayload,
    PracticeLoadContext
  >({
    buildGeneratePayload,
    defaultCycleMinutes: DEFAULT_CYCLE_MINUTES,
    defaultEndTime: "08:30",
    eventCode,
    generateErrorMessage: "Failed to generate schedule.",
    generateSchedule: generatePractice,
    loadErrorMessage: "Failed to load.",
    loadSchedule: loadPractice,
    missingGenerateTokenMessage:
      "You must be logged in to generate practice schedule.",
    missingLoadTokenMessage:
      "You must be logged in to manage practice schedule.",
    onGenerated: handleGeneratedSchedule,
    onLoaded: handleLoadedSchedule,
    token,
  });

  const hasMatches = state.matches.length > 0;
  const totalMatchesRequired = Math.ceil((teamCount * matchesPerTeam) / 2);
  const firstBlock = matchBlocks[0];
  const cycleTimeSeconds =
    (firstBlock?.cycleTimeMinutes ?? DEFAULT_CYCLE_MINUTES) * 60;

  const handleCycleTimeChange = useCallback(
    (seconds: number) => {
      const minutes = Math.max(1, seconds) / 60;
      setMatchBlocks((prev) =>
        prev.map((block) => ({ ...block, cycleTimeMinutes: minutes }))
      );
    },
    [setMatchBlocks]
  );

  const metrics = computeOneVsOneScheduleMetrics(state.matches);

  const tableRows = buildPracticeMatchRows({
    fieldCount: state.fieldCount,
    fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
    firstBlock,
    matches: state.matches,
    scheduleDate,
    teamNamesByNumber,
  });

  const actionHandlers = createPracticeScheduleActionHandlers({
    dispatch,
    eventCode,
    exportRows: tableRows,
    fileInputRef,
    hasMatches,
    matchBlocks,
    scheduleDate,
    setErrorMessage,
    setSuccessMessage,
    state,
    token,
  });

  const handlePrintGeneratedMatches = useCallback(
    (destination: PrintDestination): void => {
      setErrorMessage(null);

      try {
        printPracticeScheduleResults({
          destination,
          eventCode,
          rows: tableRows,
        });
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to open print dialog."
        );
      }
    },
    [eventCode, setErrorMessage, tableRows]
  );

  return (
    <OneVsOneScheduleView
      alerts={
        <>
          {teamCount === 0 ? (
            <div
              className="message-block schedule-alert schedule-alert--tight"
              data-variant="danger"
            >
              Warning - You have added unpaid or unregistered teams. This
              event&apos;s data may not sync in real-time to
              ftc-events.firstinspires.org.
            </div>
          ) : null}
          <div
            className="message-block schedule-alert schedule-alert--center"
            data-variant="warning"
          >
            <strong>
              WARNING: This is the practice match schedule, not the
              qualification match schedule.
            </strong>
          </div>
        </>
      }
      beforeGeneratedSection={
        <ScheduleCsvSection
          description="Import or export schedule CSV using the table columns: Start Time, Match, Field, Red, Blue."
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
            matchesPerTeam: { min: 1, onChange: setMatchesPerTeam },
            fieldCount: {
              min: 1,
              max: state.maxFieldCount,
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
          generatedMatchCount={state.matches.length}
          isActive={state.isActive}
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
      generatedEmptyMessage="No practice matches available."
      generatedMatches={tableRows}
      hasMatches={hasMatches}
      isGeneratedPrintDisabled={!hasMatches}
      isLoading={isLoading}
      matchBlocks={matchBlocks}
      onMatchBlocksChange={setMatchBlocks}
      onPrintGeneratedMatches={handlePrintGeneratedMatches}
      onScheduleDateChange={setScheduleDate}
      scheduleDate={scheduleDate}
      successMessage={successMessage}
      teamCount={teamCount}
      title="Practice Match Schedule"
      toolbar={() => (
        <ScheduleManagementToolbar
          hasMatches={hasMatches}
          isActive={state.isActive}
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
