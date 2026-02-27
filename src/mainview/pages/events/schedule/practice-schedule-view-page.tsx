import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchPracticeSchedule,
  printPracticeScheduleResults,
} from "../../../features/events/services/schedule/practice-schedule-service";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import "../../../app/styles/components/schedule.css";
import {
  type ScheduleMatchRow,
  ScheduleMatchTable,
} from "./components/schedule-match-table";

interface PracticeScheduleViewPageProps {
  eventCode: string;
  token: string | null;
}

const mapPracticeMatchesToRows = ({
  fieldCount,
  matches,
}: {
  fieldCount: number;
  matches: Array<{
    blueSurrogate: boolean;
    blueTeam: number;
    blueTeamName?: string;
    matchNumber: number;
    redSurrogate: boolean;
    redTeam: number;
    redTeamName?: string;
    startTime: number;
  }>;
}): ScheduleMatchRow[] =>
  matches.map((match) => ({
    matchNumber: match.matchNumber,
    startTime: match.startTime,
    matchLabel: `Practice ${match.matchNumber}`,
    fieldNumber: ((match.matchNumber - 1) % Math.max(1, fieldCount)) + 1,
    redTeam: match.redTeam,
    redTeamName: match.redTeamName,
    redSurrogate: match.redSurrogate,
    blueTeam: match.blueTeam,
    blueTeamName: match.blueTeamName,
    blueSurrogate: match.blueSurrogate,
  }));

export const PracticeScheduleViewPage = ({
  eventCode,
  token,
}: PracticeScheduleViewPageProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<ScheduleMatchRow[]>([]);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setErrorMessage(null);

    fetchPracticeSchedule(eventCode, token ?? "")
      .then((schedule) => {
        if (isCancelled) {
          return;
        }

        setTableRows(
          mapPracticeMatchesToRows({
            fieldCount: schedule.config.fieldCount,
            matches: schedule.matches,
          })
        );
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to load practice schedule."
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token]);

  const printRows = useMemo(
    () =>
      tableRows.map((row) => ({
        matchNumber: row.matchNumber,
        matchLabel: row.matchLabel,
        fieldNumber: row.fieldNumber,
        startTime: row.startTime,
        redTeam: row.redTeam,
        redSurrogate: row.redSurrogate,
        blueTeam: row.blueTeam,
        blueSurrogate: row.blueSurrogate,
      })),
    [tableRows]
  );

  const handlePrintClick = useCallback((): void => {
    try {
      printPracticeScheduleResults({
        destination: "paper",
        eventCode,
        rows: printRows,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to open print dialog."
      );
    }
  }, [eventCode, printRows]);

  if (isLoading) {
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
            aria-label="Print practice schedule"
            className="schedule-public-view__print-text-button"
            disabled={printRows.length === 0}
            onClick={handlePrintClick}
            type="button"
          >
            Print
          </button>
        </div>

        <header className="schedule-public-view__header">
          <h2 className="app-heading schedule-page-title schedule-public-view__title">
            {eventCode.toUpperCase()} Practice Schedule
          </h2>
        </header>

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="schedule-public-view__table-wrap">
          <ScheduleMatchTable
            emptyMessage="No practice matches available."
            matches={tableRows}
          />
        </div>
      </div>
    </main>
  );
};
