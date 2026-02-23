import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchQualificationSchedule,
  printQualificationScheduleResults,
} from "../../../features/events/services/schedule/qualification-schedule-service";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import "../../../app/styles/components/schedule.css";
import {
  type ScheduleMatchRow,
  ScheduleMatchTable,
} from "./components/schedule-match-table";

interface QualificationScheduleViewPageProps {
  eventCode: string;
  token: string | null;
}

const mapQualificationMatchesToRows = ({
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
    matchLabel: `Qualification ${match.matchNumber}`,
    fieldNumber: ((match.matchNumber - 1) % Math.max(1, fieldCount)) + 1,
    redTeam: match.redTeam,
    redTeamName: match.redTeamName,
    redSurrogate: match.redSurrogate,
    blueTeam: match.blueTeam,
    blueTeamName: match.blueTeamName,
    blueSurrogate: match.blueSurrogate,
  }));

export const QualificationScheduleViewPage = ({
  eventCode,
  token,
}: QualificationScheduleViewPageProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tableRows, setTableRows] = useState<ScheduleMatchRow[]>([]);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setErrorMessage(null);

    fetchQualificationSchedule(eventCode, token ?? "")
      .then((schedule) => {
        if (isCancelled) {
          return;
        }

        setTableRows(
          mapQualificationMatchesToRows({
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
            : "Failed to load qualification schedule."
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
      printQualificationScheduleResults({
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
    <main className="page-shell page-shell--top schedule-page">
      <div className="card surface-card stack schedule-page-shell schedule-public-view">
        <a
          className="back-link schedule-page-back-link"
          href={`/event/${eventCode}`}
        >
          &lt;&lt; Back to Event Home
        </a>

        <header className="schedule-public-view__header">
          <h2 className="app-heading schedule-page-title schedule-public-view__title">
            {eventCode.toUpperCase()} Qualification Schedule
          </h2>
          <button
            aria-label="Print qualification schedule"
            className="schedule-public-view__print-button"
            disabled={printRows.length === 0}
            onClick={handlePrintClick}
            title="Print"
            type="button"
          >
            <svg
              fill="currentColor"
              viewBox="0 0 16 16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <title>Print</title>
              <path d="M2 7a2 2 0 0 1 2-2h1V2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3h1a2 2 0 0 1 2 2v3H12v4H4v-4H2zm2 1H3v2h1zm8 0v2h1V8zm-2-3V2H6v3zM5 10v3h6v-3z" />
            </svg>
          </button>
        </header>

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="schedule-public-view__table-wrap">
          <ScheduleMatchTable
            emptyMessage="No qualification matches available."
            matches={tableRows}
          />
        </div>
      </div>
    </main>
  );
};
