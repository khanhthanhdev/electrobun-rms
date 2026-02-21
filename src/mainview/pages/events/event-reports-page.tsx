import { useCallback, useEffect, useState } from "react";
import {
  type EventPrintListsResponse,
  fetchEventPrintLists,
  type PrintableAccountItem,
  type PrintableMatchItem,
  type PrintableScheduleItem,
  type PrintableTeamItem,
} from "../../features/events/services/event-print-lists-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import {
  type PrintDestination,
  printTable,
} from "../../shared/services/print-service";

interface EventReportsPageProps {
  eventCode: string;
  token: string | null;
}

const formatDateTimeValue = (value: string | null): string => {
  if (!value) {
    return "-";
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return parsedDate.toLocaleString();
};

const buildPrintErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Failed to open print dialog.";

export const EventReportsPage = ({
  eventCode,
  token,
}: EventReportsPageProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [printErrorMessage, setPrintErrorMessage] = useState<string | null>(
    null
  );
  const [reportData, setReportData] = useState<EventPrintListsResponse | null>(
    null
  );

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      setErrorMessage("You must be logged in to view event reports.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setPrintErrorMessage(null);

    fetchEventPrintLists(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          setReportData(result);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Failed to load printable reports."
          );
        }
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

  const printAccounts = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      setPrintErrorMessage(null);

      try {
        printTable<PrintableAccountItem>({
          destination,
          generatedAt: reportData.generatedAt,
          title: `${eventCode.toUpperCase()} Accounts`,
          subtitle: "Account list",
          rows: reportData.accounts,
          emptyMessage: "No accounts found for this event.",
          columns: [
            { header: "Username", formatValue: (row) => row.username },
            { header: "Role", formatValue: (row) => row.role },
            {
              header: "Password",
              formatValue: (row) => row.password ?? "-",
            },
          ],
        });
      } catch (error) {
        setPrintErrorMessage(buildPrintErrorMessage(error));
      }
    },
    [eventCode, reportData]
  );

  const printTeams = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      setPrintErrorMessage(null);

      try {
        printTable<PrintableTeamItem>({
          destination,
          generatedAt: reportData.generatedAt,
          title: `${eventCode.toUpperCase()} Teams`,
          subtitle: "Team list",
          rows: reportData.teams,
          emptyMessage: "No teams found for this event.",
          columns: [
            {
              header: "Team Number",
              formatValue: (row) => String(row.teamNumber),
            },
            { header: "Name", formatValue: (row) => row.name },
            { header: "Location", formatValue: (row) => row.location || "-" },
          ],
        });
      } catch (error) {
        setPrintErrorMessage(buildPrintErrorMessage(error));
      }
    },
    [eventCode, reportData]
  );

  const printMatches = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      setPrintErrorMessage(null);

      try {
        printTable<PrintableMatchItem>({
          destination,
          generatedAt: reportData.generatedAt,
          title: `${eventCode.toUpperCase()} Matches`,
          subtitle: "Match list",
          rows: reportData.matches,
          emptyMessage: "No matches found for this event.",
          columns: [
            { header: "Match ID", formatValue: (row) => row.matchId },
            { header: "Play #", formatValue: (row) => String(row.playNumber) },
            {
              header: "Field Type",
              formatValue: (row) => String(row.fieldType),
            },
            {
              header: "Score",
              formatValue: (row) => `${row.redScore} - ${row.blueScore}`,
            },
            {
              header: "Start Time",
              formatValue: (row) => formatDateTimeValue(row.startTime),
            },
          ],
        });
      } catch (error) {
        setPrintErrorMessage(buildPrintErrorMessage(error));
      }
    },
    [eventCode, reportData]
  );

  const printSchedule = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      setPrintErrorMessage(null);

      try {
        printTable<PrintableScheduleItem>({
          destination,
          generatedAt: reportData.generatedAt,
          title: `${eventCode.toUpperCase()} Schedule`,
          subtitle: "Schedule list",
          rows: reportData.schedules,
          emptyMessage: "No schedule entries found for this event.",
          columns: [
            { header: "Stage", formatValue: (row) => row.stage },
            {
              header: "Match #",
              formatValue: (row) =>
                row.matchNumber === null ? "-" : String(row.matchNumber),
            },
            {
              header: "Description",
              formatValue: (row) => row.description || "-",
            },
            {
              header: "Start Time",
              formatValue: (row) => formatDateTimeValue(row.startTime),
            },
          ],
        });
      } catch (error) {
        setPrintErrorMessage(buildPrintErrorMessage(error));
      }
    },
    [eventCode, reportData]
  );

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (errorMessage || !reportData) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage ?? "Failed to load report data."}
          </p>
          <a className="app-link-inline" href={`/event/${eventCode}/dashboard`}>
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--xlarge stack stack--compact">
        <header className="stack stack--tight">
          <h2 className="app-heading">Event Reports - {eventCode}</h2>
          <p className="app-subheading">
            Print to paper or export to PDF for account, team, match, and
            schedule lists.
          </p>
          <p className="form-note">
            Generated: {formatDateTimeValue(reportData.generatedAt)}
          </p>
        </header>

        {printErrorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {printErrorMessage}
          </p>
        ) : null}

        <details className="report-collapsible" open>
          <summary className="report-collapsible-summary">
            Accounts ({reportData.accounts.length})
          </summary>
          <div className="report-collapsible-body">
            <div className="table-wrap">
              <table className="table-users table-report">
                <thead>
                  <tr>
                    <th scope="col">Username</th>
                    <th scope="col">Role</th>
                    <th scope="col">Password</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.accounts.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No accounts found.</td>
                    </tr>
                  ) : (
                    reportData.accounts.map((account) => (
                      <tr key={`${account.username}-${account.role}`}>
                        <td>{account.username}</td>
                        <td>{account.role}</td>
                        <td>{account.password ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button
                data-variant="secondary"
                onClick={() => {
                  printAccounts("paper");
                }}
                type="button"
              >
                Print Accounts (Paper)
              </button>
              <button
                onClick={() => {
                  printAccounts("pdf");
                }}
                type="button"
              >
                Export Accounts (PDF)
              </button>
            </div>
          </div>
        </details>

        <details className="report-collapsible">
          <summary className="report-collapsible-summary">
            Teams ({reportData.teams.length})
          </summary>
          <div className="report-collapsible-body">
            <div className="table-wrap">
              <table className="table-users table-report">
                <thead>
                  <tr>
                    <th scope="col">Team Number</th>
                    <th scope="col">Name</th>
                    <th scope="col">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.teams.length === 0 ? (
                    <tr>
                      <td colSpan={3}>No teams found.</td>
                    </tr>
                  ) : (
                    reportData.teams.map((team) => (
                      <tr key={team.teamNumber}>
                        <td>{team.teamNumber}</td>
                        <td>{team.name}</td>
                        <td>{team.location || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button
                data-variant="secondary"
                onClick={() => {
                  printTeams("paper");
                }}
                type="button"
              >
                Print Teams (Paper)
              </button>
              <button
                onClick={() => {
                  printTeams("pdf");
                }}
                type="button"
              >
                Export Teams (PDF)
              </button>
            </div>
          </div>
        </details>

        <details className="report-collapsible">
          <summary className="report-collapsible-summary">
            Matches ({reportData.matches.length})
          </summary>
          <div className="report-collapsible-body">
            <div className="table-wrap">
              <table className="table-users table-report">
                <thead>
                  <tr>
                    <th scope="col">Match ID</th>
                    <th scope="col">Play #</th>
                    <th scope="col">Field Type</th>
                    <th scope="col">Score (R-B)</th>
                    <th scope="col">Start Time</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.matches.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No matches found.</td>
                    </tr>
                  ) : (
                    reportData.matches.map((match) => (
                      <tr key={match.matchId}>
                        <td>{match.matchId}</td>
                        <td>{match.playNumber}</td>
                        <td>{match.fieldType}</td>
                        <td>
                          {match.redScore}-{match.blueScore}
                        </td>
                        <td>{formatDateTimeValue(match.startTime)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button
                data-variant="secondary"
                onClick={() => {
                  printMatches("paper");
                }}
                type="button"
              >
                Print Matches (Paper)
              </button>
              <button
                onClick={() => {
                  printMatches("pdf");
                }}
                type="button"
              >
                Export Matches (PDF)
              </button>
            </div>
          </div>
        </details>

        <details className="report-collapsible">
          <summary className="report-collapsible-summary">
            Schedule ({reportData.schedules.length})
          </summary>
          <div className="report-collapsible-body">
            <div className="table-wrap">
              <table className="table-users table-report">
                <thead>
                  <tr>
                    <th scope="col">Stage</th>
                    <th scope="col">Match #</th>
                    <th scope="col">Description</th>
                    <th scope="col">Start Time</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.schedules.length === 0 ? (
                    <tr>
                      <td colSpan={4}>No schedule entries found.</td>
                    </tr>
                  ) : (
                    reportData.schedules.map((schedule, index) => (
                      <tr
                        key={`${schedule.stage}-${schedule.matchNumber ?? "na"}-${index}`}
                      >
                        <td>{schedule.stage}</td>
                        <td>{schedule.matchNumber ?? "-"}</td>
                        <td>{schedule.description || "-"}</td>
                        <td>{formatDateTimeValue(schedule.startTime)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button
                data-variant="secondary"
                onClick={() => {
                  printSchedule("paper");
                }}
                type="button"
              >
                Print Schedule (Paper)
              </button>
              <button
                onClick={() => {
                  printSchedule("pdf");
                }}
                type="button"
              >
                Export Schedule (PDF)
              </button>
            </div>
          </div>
        </details>

        <div className="form-actions">
          <a className="button" href={`/event/${eventCode}/dashboard`}>
            Back to Dashboard
          </a>
        </div>
      </section>
    </main>
  );
};
