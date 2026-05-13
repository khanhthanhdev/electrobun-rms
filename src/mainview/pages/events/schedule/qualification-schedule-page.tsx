import { useCallback, useReducer, useRef } from "react";
import {
  clearQualificationSchedule,
  fetchQualificationSchedule,
  type GenerateQualificationSchedulePayload,
  generateQualificationSchedule,
  type QualificationScheduleResponse,
  saveQualificationSchedule,
  setQualificationScheduleActivation,
} from "@/features/events/schedule";
import { type EventTeamItem, fetchEventTeams } from "@/features/events/teams";
import {
  buildOneVsOneMatchRows,
  createOneVsOneActivationClickHandler,
  createOneVsOneClearClickHandler,
  createOneVsOneCsvImportClickHandler,
  createScheduleAdminDispatchers,
  exportOneVsOneMatchesCsv,
  mapCsvMatchesToScheduleMatches,
  reduceOneVsOneScheduleAdminBaseAction,
  resolveOneVsOneFirstBlockTiming,
} from "@/widgets/schedule/one-vs-one-schedule-admin-helpers";
import { OneVsOneScheduleAdminOverview } from "@/widgets/schedule/one-vs-one-schedule-admin-overview";
import { ScheduleCsvSection } from "@/widgets/schedule/schedule-csv-section";
import { ScheduleManagementToolbar } from "@/widgets/schedule/schedule-management-toolbar";
import type { ScheduleMatchRow } from "@/widgets/schedule/schedule-match-table";
import { EMPTY_ONE_VS_ONE_SCHEDULE_METRICS } from "@/widgets/schedule/schedule-metrics";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import {
  getFirstBlockStartTime,
  type OneVsOneGenerateResult,
  type OneVsOneLoadResult,
  useOneVsOneScheduleController,
} from "@/widgets/schedule/use-one-vs-one-schedule-controller";
import { OneVsOneScheduleView } from "./components/one-vs-one-schedule-view";
import {
  buildTeamNamesByNumber,
  type TeamNamesByNumber,
} from "./team-names-by-number";

interface QualificationSchedulePageProps {
  eventCode: string;
  token: string | null;
}

const DEFAULT_CYCLE_MINUTES = 4;
const DEFAULT_FIELD_COUNT = 1;
const DEFAULT_FIELD_START_OFFSET_SECONDS = 15;
const DEFAULT_MATCHES_PER_TEAM = 6;

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
  | { type: "SET_IS_CLEARING"; payload: boolean }
  | { type: "SET_IS_IMPORTING"; payload: boolean }
  | { type: "SET_IS_UPDATING_ACTIVATION"; payload: boolean }
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
    case "SET_MATCHES_PER_TEAM":
      return { ...state, matchesPerTeam: Math.max(1, action.payload) };
    case "SET_SCHEDULE":
      return { ...state, schedule: action.payload };
    default:
      return reduceOneVsOneScheduleAdminBaseAction(state, action) ?? state;
  }
};

const mapQualsToMatchRows = (
  schedule: QualificationScheduleResponse,
  fieldStartOffsetSeconds: number,
  fieldCount: number,
  teamNamesByNumber: TeamNamesByNumber
): ScheduleMatchRow[] => {
  const safeFieldCount = Math.max(1, fieldCount);
  const baseStartTime =
    schedule.config.startTime ?? schedule.matches[0]?.startTime ?? Date.now();

  return buildOneVsOneMatchRows({
    baseStartTime,
    cycleTimeSeconds: schedule.config.cycleTimeSeconds,
    fieldCount: safeFieldCount,
    fieldStartOffsetSeconds,
    labelPrefix: "Quals",
    matches: schedule.matches,
    teamNamesByNumber,
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

export const QualificationSchedulePage = ({
  eventCode,
  token,
}: QualificationSchedulePageProps): JSX.Element => {
  const [state, dispatch] = useReducer(qualificationReducer, initialState);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const applyQualificationSchedule = useCallback(
    (schedule: QualificationScheduleResponse): void => {
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload:
          schedule.config.fieldStartOffsetSeconds ??
          DEFAULT_FIELD_START_OFFSET_SECONDS,
      });
      dispatch({
        type: "SET_FIELD_COUNT",
        payload: schedule.config.fieldCount ?? DEFAULT_FIELD_COUNT,
      });
      dispatch({
        type: "SET_MATCHES_PER_TEAM",
        payload: schedule.config.matchesPerTeam ?? DEFAULT_MATCHES_PER_TEAM,
      });
      dispatch({ type: "SET_SCHEDULE", payload: schedule });
    },
    []
  );

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
      applyQualificationSchedule(result.schedule);
    },
    [applyQualificationSchedule]
  );

  const handleGeneratedSchedule = useCallback(
    (result: OneVsOneGenerateResult<QualificationScheduleResponse>): void => {
      applyQualificationSchedule(result.schedule);
    },
    [applyQualificationSchedule]
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

  const { setIsClearing, setIsImporting, setIsUpdatingActivation } =
    createScheduleAdminDispatchers(dispatch);

  const hasMatches = (state.schedule?.matches.length ?? 0) > 0;
  const isActive = state.schedule?.isActive ?? false;
  const matchesPerTeam = state.matchesPerTeam;
  const totalMatchesRequired = Math.ceil((teamCount * matchesPerTeam) / 2);
  const cycleTimeSeconds =
    (matchBlocks[0]?.cycleTimeMinutes ?? DEFAULT_CYCLE_MINUTES) * 60;
  const fieldStartOffsetSecondsMax = Math.max(0, cycleTimeSeconds - 1);

  const handleCycleTimeChange = useCallback(
    (seconds: number) => {
      dispatch({
        type: "SET_FIELD_START_OFFSET",
        payload: Math.min(
          state.fieldStartOffsetSeconds,
          Math.max(0, seconds - 1)
        ),
      });
    },
    [state.fieldStartOffsetSeconds]
  );

  const metrics = state.schedule?.metrics ?? EMPTY_ONE_VS_ONE_SCHEDULE_METRICS;
  const teamNamesByNumber = context?.teamNamesByNumber ?? {};
  const tableRows = state.schedule
    ? mapQualsToMatchRows(
        state.schedule,
        state.fieldStartOffsetSeconds,
        state.fieldCount,
        teamNamesByNumber
      )
    : [];

  const handleImportCsvClick = createOneVsOneCsvImportClickHandler({
    fileInputRef,
    missingTokenMessage:
      "You must be logged in to import qualification schedule.",
    onImportedScheduleSaved: applyQualificationSchedule,
    resolveTiming: () => {
      const timing = resolveOneVsOneFirstBlockTiming({
        matchBlocks,
        scheduleDate,
        setErrorMessage,
      });
      return timing
        ? {
            ...timing,
            fieldCount: state.fieldCount,
            fieldStartOffsetSeconds: state.fieldStartOffsetSeconds,
            matchesPerTeam: state.matchesPerTeam,
          }
        : null;
    },
    saveImportedSchedule: (importedMatches, timing, currentToken) =>
      saveQualificationSchedule(
        eventCode,
        {
          startTime: timing.startTime,
          cycleTimeSeconds: timing.cycleTimeSeconds,
          fieldCount: timing.fieldCount,
          fieldStartOffsetSeconds: timing.fieldStartOffsetSeconds,
          matches: mapCsvMatchesToScheduleMatches(importedMatches),
        },
        currentToken
      ),
    setErrorMessage,
    setIsImporting,
    setSuccessMessage,
    successMessage: (importedMatches) =>
      `Imported and saved ${importedMatches.length} qualification matches.`,
    token,
  });

  const handleClearClick = createOneVsOneClearClickHandler({
    clearSchedule: (currentToken) =>
      clearQualificationSchedule(eventCode, currentToken),
    failureMessage: "Failed to clear qualification schedule.",
    fetchSchedule: (currentToken) =>
      fetchQualificationSchedule(eventCode, currentToken),
    missingTokenMessage:
      "You must be logged in to clear qualification schedule.",
    onScheduleCleared: applyQualificationSchedule,
    setErrorMessage,
    setIsClearing,
    setSuccessMessage,
    successMessage: "Qualification schedule cleared.",
    token,
  });

  const handleToggleActivationClick = createOneVsOneActivationClickHandler({
    hasMatches,
    isActive,
    missingMatchesMessage:
      "Generate or import matches before activating schedule.",
    missingTokenMessage:
      "You must be logged in to update qualification schedule activation.",
    onActivationUpdated: applyQualificationSchedule,
    setActivation: (active, currentToken) =>
      setQualificationScheduleActivation(eventCode, active, currentToken),
    setErrorMessage,
    setIsUpdatingActivation,
    setSuccessMessage,
    successMessage: (result) =>
      result.isActive
        ? "Qualification schedule activated."
        : "Qualification schedule deactivated.",
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
          onExport={() =>
            exportOneVsOneMatchesCsv({
              eventCode,
              fileSuffix: "qualification-matches",
              rows: tableRows,
            })
          }
          onImport={handleImportCsvClick}
        />
      }
      configSection={
        <OneVsOneScheduleAdminOverview
          fieldCount={state.fieldCount}
          fieldStartOffsetSeconds={state.fieldStartOffsetSeconds}
          fieldStartOffsetSecondsMax={fieldStartOffsetSecondsMax}
          generatedMatchCount={state.schedule?.matches.length ?? 0}
          isActive={isActive}
          matchesPerTeam={matchesPerTeam}
          metrics={metrics}
          onFieldCountChange={(value) =>
            dispatch({ type: "SET_FIELD_COUNT", payload: value })
          }
          onFieldStartOffsetSecondsChange={(value) =>
            dispatch({ type: "SET_FIELD_START_OFFSET", payload: value })
          }
          onMatchesPerTeamChange={(value) =>
            dispatch({ type: "SET_MATCHES_PER_TEAM", payload: value })
          }
          teamCount={teamCount}
          totalMatchesRequired={totalMatchesRequired}
        />
      }
      defaultCycleTimeMinutes={DEFAULT_CYCLE_MINUTES}
      errorMessage={errorMessage}
      generatedEmptyMessage="No qualification matches available."
      generatedMatches={tableRows}
      hasMatches={hasMatches}
      isLoading={isLoading}
      matchBlocks={matchBlocks}
      matchEditorMode="qualification"
      onCycleTimeSecondsChange={handleCycleTimeChange}
      onMatchBlocksChange={setMatchBlocks}
      onScheduleDateChange={setScheduleDate}
      scheduleDate={scheduleDate}
      successMessage={successMessage}
      title="Qualification Match Schedule"
      toolbar={() => (
        <ScheduleManagementToolbar
          hasMatches={hasMatches}
          isActive={isActive}
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
