import { useCallback, useReducer, useRef, useState } from "react";
import {
  clearPracticeSchedule,
  fetchPracticeSchedule,
  type GeneratePracticeSchedulePayload,
  generatePracticeSchedule,
  type PracticeScheduleResponse,
  printPracticeScheduleResults,
  savePracticeSchedule,
  setPracticeScheduleActivation,
} from "@/features/events/schedule";
import { type EventTeamItem, fetchEventTeams } from "@/features/events/teams";
import type { PrintDestination } from "@/shared/services/print-service";
import {
  buildOneVsOneMatchRowsFromFirstBlock,
  createOneVsOneActivationClickHandler,
  createOneVsOneClearClickHandler,
  createOneVsOneCsvImportClickHandler,
  createScheduleAdminDispatchers,
  exportOneVsOneMatchesCsv,
  mapCsvMatchesToScheduleMatches,
  mapScheduleMatchesToEditable,
  type OneVsOneEditableMatch,
  reduceOneVsOneScheduleAdminBaseAction,
  resolveOneVsOneFirstBlockTiming,
  updateOneVsOneCycleTime,
} from "@/widgets/schedule/one-vs-one-schedule-admin-helpers";
import { OneVsOneScheduleAdminOverview } from "@/widgets/schedule/one-vs-one-schedule-admin-overview";
import { ScheduleCsvSection } from "@/widgets/schedule/schedule-csv-section";
import { ScheduleManagementToolbar } from "@/widgets/schedule/schedule-management-toolbar";
import { computeOneVsOneScheduleMetrics } from "@/widgets/schedule/schedule-metrics";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import {
  type OneVsOneGenerateResult,
  type OneVsOneLoadResult,
  useOneVsOneScheduleController,
} from "@/widgets/schedule/use-one-vs-one-schedule-controller";
import { OneVsOneScheduleView } from "./components/one-vs-one-schedule-view";
import {
  buildTeamNamesByNumber,
  type TeamNamesByNumber,
} from "./team-names-by-number";

interface PracticeSchedulePageProps {
  eventCode: string;
  token: string | null;
}

const DEFAULT_CYCLE_MINUTES = 7;
const DEFAULT_FIELD_START_OFFSET_SECONDS = 0;

type EditablePracticeMatch = OneVsOneEditableMatch;

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
    case "SET_IS_ACTIVE":
      return { ...state, isActive: action.payload };
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
      return reduceOneVsOneScheduleAdminBaseAction(state, action) ?? state;
  }
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

  const applyPracticeSchedule = useCallback(
    (schedule: PracticeScheduleResponse): void => {
      const serverFieldCount = schedule.config.fieldCount || 1;
      dispatch({ type: "SET_MAX_FIELD_COUNT", payload: serverFieldCount });
      dispatch({ type: "SET_FIELD_COUNT", payload: serverFieldCount });
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({ type: "SET_IS_ACTIVE", payload: schedule.isActive });
      dispatch({
        type: "SET_MATCHES",
        payload: mapScheduleMatchesToEditable(schedule.matches),
      });
    },
    []
  );

  const handleLoadedSchedule = useCallback(
    (
      result: OneVsOneLoadResult<PracticeScheduleResponse, PracticeLoadContext>
    ): void => {
      applyPracticeSchedule(result.schedule);
      setTeamNamesByNumber(result.context?.teamNamesByNumber ?? {});
    },
    [applyPracticeSchedule]
  );

  const handleGeneratedSchedule = useCallback(
    (result: OneVsOneGenerateResult<PracticeScheduleResponse>): void => {
      applyPracticeSchedule(result.schedule);
    },
    [applyPracticeSchedule]
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

  const { setIsClearing, setIsImporting, setIsUpdatingActivation } =
    createScheduleAdminDispatchers(dispatch);

  const hasMatches = state.matches.length > 0;
  const totalMatchesRequired = Math.ceil((teamCount * matchesPerTeam) / 2);
  const firstBlock = matchBlocks[0];
  const cycleTimeSeconds =
    (firstBlock?.cycleTimeMinutes ?? DEFAULT_CYCLE_MINUTES) * 60;

  const handleCycleTimeChange = useCallback(
    (seconds: number) => {
      updateOneVsOneCycleTime(setMatchBlocks, seconds);
    },
    [setMatchBlocks]
  );

  const metrics = computeOneVsOneScheduleMetrics(state.matches);

  const tableRows = buildOneVsOneMatchRowsFromFirstBlock({
    fieldCount: state.fieldCount,
    fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
    fieldNumberForMatch: (match, _index, safeFieldCount) =>
      ((match.matchNumber - 1) % safeFieldCount) + 1,
    firstBlock,
    labelPrefix: "Practice",
    matches: state.matches,
    scheduleDate,
    teamNamesByNumber,
  });

  const handleImportCsvClick = createOneVsOneCsvImportClickHandler({
    fileInputRef,
    missingTokenMessage: "You must be logged in to import practice schedule.",
    onImportedScheduleSaved: applyPracticeSchedule,
    resolveTiming: () =>
      resolveOneVsOneFirstBlockTiming({
        matchBlocks,
        scheduleDate,
        setErrorMessage,
      }),
    saveImportedSchedule: (importedMatches, timing, currentToken) =>
      savePracticeSchedule(
        eventCode,
        {
          startTime: timing.startTime,
          cycleTimeSeconds: timing.cycleTimeSeconds,
          matches: mapCsvMatchesToScheduleMatches(importedMatches),
        },
        currentToken
      ),
    setErrorMessage,
    setIsImporting,
    setSuccessMessage,
    successMessage: (importedMatches) =>
      `Imported and saved ${importedMatches.length} practice matches.`,
    token,
  });

  const handleClearClick = createOneVsOneClearClickHandler({
    clearSchedule: (currentToken) =>
      clearPracticeSchedule(eventCode, currentToken),
    failureMessage: "Failed to clear practice schedule.",
    fetchSchedule: (currentToken) =>
      fetchPracticeSchedule(eventCode, currentToken),
    missingTokenMessage: "You must be logged in to clear practice schedule.",
    onScheduleCleared: applyPracticeSchedule,
    setErrorMessage,
    setIsClearing,
    setSuccessMessage,
    successMessage: "Practice schedule cleared.",
    token,
  });

  const handleToggleActivationClick = createOneVsOneActivationClickHandler({
    hasMatches,
    isActive: state.isActive,
    missingMatchesMessage:
      "Generate or import matches before activating schedule.",
    missingTokenMessage:
      "You must be logged in to update practice schedule activation.",
    onActivationUpdated: applyPracticeSchedule,
    setActivation: (active, currentToken) =>
      setPracticeScheduleActivation(eventCode, active, currentToken),
    setErrorMessage,
    setIsUpdatingActivation,
    setSuccessMessage,
    successMessage: (result) =>
      result.isActive
        ? "Practice schedule activated."
        : "Practice schedule deactivated.",
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
          onExport={() =>
            exportOneVsOneMatchesCsv({
              eventCode,
              fileSuffix: "practice-matches",
              rows: tableRows,
            })
          }
          onImport={handleImportCsvClick}
        />
      }
      configSection={
        <OneVsOneScheduleAdminOverview
          cycleTimeSeconds={cycleTimeSeconds}
          fieldCount={state.fieldCount}
          fieldCountMax={state.maxFieldCount}
          fieldStartOffsetSeconds={state.fieldStartOffsetSeconds}
          generatedMatchCount={state.matches.length}
          isActive={state.isActive}
          matchesPerTeam={matchesPerTeam}
          metrics={metrics}
          onCycleTimeSecondsChange={handleCycleTimeChange}
          onFieldCountChange={(value) =>
            dispatch({ type: "SET_FIELD_COUNT", payload: value })
          }
          onFieldStartOffsetSecondsChange={(value) =>
            dispatch({ type: "SET_FIELD_START_OFFSET", payload: value })
          }
          onMatchesPerTeamChange={setMatchesPerTeam}
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
          onClear={handleClearClick}
          onGenerate={handleGenerate}
          onToggleActivation={handleToggleActivationClick}
        />
      )}
    />
  );
};
