import { useCallback, useEffect, useReducer } from "react";
import type { OneVsOneScheduleMatch } from "@/features/events/schedule";
import { LoadingIndicator } from "@/shared/components/loading-indicator";
import {
  type ScheduleMatchRow,
  ScheduleMatchTable,
} from "@/widgets/schedule/schedule-match-table";

interface OneVsOnePublicScheduleData {
  config: {
    fieldCount: number;
  };
  matches: OneVsOneScheduleMatch[];
}

interface OneVsOneSchedulePublicViewProps {
  emptyMessage: string;
  eventCode: string;
  fetchSchedule: (
    eventCode: string,
    token: string | null
  ) => Promise<OneVsOnePublicScheduleData>;
  loadErrorMessage: string;
  matchLabelPrefix: string;
  onPrint: (args: { eventCode: string; rows: ScheduleMatchRow[] }) => void;
  printAriaLabel: string;
  scheduleTitle: string;
  token: string | null;
}

interface OneVsOneSchedulePublicViewState {
  errorMessage: string | null;
  isLoading: boolean;
  tableRows: ScheduleMatchRow[];
}

type OneVsOneSchedulePublicViewAction =
  | { type: "start" }
  | { type: "success"; tableRows: ScheduleMatchRow[] }
  | { type: "error"; errorMessage: string }
  | { type: "print_error"; errorMessage: string };

const mapMatchesToRows = ({
  fieldCount,
  matchLabelPrefix,
  matches,
}: {
  fieldCount: number;
  matchLabelPrefix: string;
  matches: OneVsOneScheduleMatch[];
}): ScheduleMatchRow[] =>
  matches.map((match) => ({
    matchNumber: match.matchNumber,
    startTime: match.startTime,
    matchLabel: `${matchLabelPrefix} ${match.matchNumber}`,
    fieldNumber: ((match.matchNumber - 1) % Math.max(1, fieldCount)) + 1,
    redTeam: match.redTeam,
    redTeamName: match.redTeamName,
    redSurrogate: match.redSurrogate,
    blueTeam: match.blueTeam,
    blueTeamName: match.blueTeamName,
    blueSurrogate: match.blueSurrogate,
  }));

const schedulePublicViewReducer = (
  state: OneVsOneSchedulePublicViewState,
  action: OneVsOneSchedulePublicViewAction
): OneVsOneSchedulePublicViewState => {
  switch (action.type) {
    case "start":
      return { ...state, isLoading: true, errorMessage: null };
    case "success":
      return {
        isLoading: false,
        errorMessage: null,
        tableRows: action.tableRows,
      };
    case "error":
      return { ...state, isLoading: false, errorMessage: action.errorMessage };
    case "print_error":
      return { ...state, errorMessage: action.errorMessage };
    default:
      return state;
  }
};

export const OneVsOneSchedulePublicView = ({
  emptyMessage,
  eventCode,
  fetchSchedule,
  loadErrorMessage,
  matchLabelPrefix,
  onPrint,
  printAriaLabel,
  scheduleTitle,
  token,
}: OneVsOneSchedulePublicViewProps): JSX.Element => {
  const [state, dispatch] = useReducer(schedulePublicViewReducer, {
    isLoading: true,
    errorMessage: null,
    tableRows: [],
  });

  useEffect(() => {
    let isCancelled = false;

    dispatch({ type: "start" });

    fetchSchedule(eventCode, token)
      .then((schedule) => {
        if (isCancelled) {
          return;
        }

        dispatch({
          type: "success",
          tableRows: mapMatchesToRows({
            fieldCount: schedule.config.fieldCount,
            matchLabelPrefix,
            matches: schedule.matches,
          }),
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        dispatch({
          type: "error",
          errorMessage:
            error instanceof Error ? error.message : loadErrorMessage,
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, fetchSchedule, loadErrorMessage, matchLabelPrefix, token]);

  const handlePrintClick = useCallback((): void => {
    try {
      onPrint({ eventCode, rows: state.tableRows });
    } catch (error) {
      dispatch({
        type: "print_error",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Failed to open print dialog.",
      });
    }
  }, [eventCode, onPrint, state.tableRows]);

  const isPrintDisabled = state.tableRows.length === 0;

  if (state.isLoading) {
    return (
      <main className="page-shell page-shell--center schedule-page">
        <LoadingIndicator />
      </main>
    );
  }

  return (
    <main className="schedule-page-shell">
      <div className="schedule-page-card schedule-public-view">
        <div className="schedule-view-top-nav">
          <a
            className="back-link schedule-page-back-link"
            href={`/event/${eventCode}`}
          >
            <span className="hide-mobile">&lt;&lt; Back to Event Home</span>
            <span className="show-mobile">&lt;- Back</span>
          </a>

          <button
            aria-label={printAriaLabel}
            className="schedule-public-view__print-text-button"
            disabled={isPrintDisabled}
            onClick={handlePrintClick}
            type="button"
          >
            Print
          </button>
        </div>

        <header className="schedule-public-view__header">
          <h2 className="app-heading schedule-page-title schedule-public-view__title">
            {eventCode.toUpperCase()} {scheduleTitle}
          </h2>
        </header>

        {state.errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {state.errorMessage}
          </p>
        ) : null}

        <div className="schedule-public-view__table-wrap">
          <ScheduleMatchTable
            emptyMessage={emptyMessage}
            matches={state.tableRows}
          />
        </div>
      </div>
    </main>
  );
};
