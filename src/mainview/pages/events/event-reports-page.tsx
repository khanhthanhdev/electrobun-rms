import {
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useReducer,
} from "react";
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

interface EventReportsPageState {
  errorMessage: string | null;
  isAccountsMounted: boolean;
  isLoading: boolean;
  isMatchesMounted: boolean;
  isScheduleMounted: boolean;
  isTeamsMounted: boolean;
  printErrorMessage: string | null;
  reportData: EventPrintListsResponse | null;
}

interface EventReportsPageAction {
  payload: Partial<EventReportsPageState>;
  type: "set";
}

const eventReportsPageInitialState: EventReportsPageState = {
  errorMessage: null,
  isAccountsMounted: true,
  isLoading: true,
  isMatchesMounted: false,
  isScheduleMounted: false,
  isTeamsMounted: false,
  printErrorMessage: null,
  reportData: null,
};

const eventReportsPageReducer = (
  state: EventReportsPageState,
  action: EventReportsPageAction
): EventReportsPageState => {
  switch (action.type) {
    case "set": {
      const payloadEntries = Object.entries(action.payload) as [
        keyof EventReportsPageState,
        EventReportsPageState[keyof EventReportsPageState],
      ][];
      const hasStateChanges = payloadEntries.some(
        ([key, value]) => state[key] !== value
      );
      if (!hasStateChanges) {
        return state;
      }

      return { ...state, ...action.payload };
    }
    default:
      return state;
  }
};

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

interface ReportTableRow {
  cells: readonly ReactNode[];
  key: string | number;
}

interface ReportTableSectionProps {
  count: number;
  emptyMessage: string;
  headers: readonly string[];
  isMounted: boolean;
  onPrintPaper: () => void;
  onPrintPdf: () => void;
  onToggle: (nextEvent: SyntheticEvent<HTMLDetailsElement>) => void;
  open?: boolean;
  paperActionLabel: string;
  pdfActionLabel: string;
  rows: readonly ReportTableRow[];
  summaryLabel: string;
}

const ReportTableSection = ({
  count,
  emptyMessage,
  headers,
  isMounted,
  onPrintPaper,
  onPrintPdf,
  onToggle,
  open,
  paperActionLabel,
  pdfActionLabel,
  rows,
  summaryLabel,
}: ReportTableSectionProps): JSX.Element => (
  <details className="report-collapsible" onToggle={onToggle} open={open}>
    <summary className="report-collapsible-summary">
      {summaryLabel} ({count})
    </summary>
    {isMounted ? (
      <div className="report-collapsible-body">
        <div className="table-wrap">
          <table className="table-users table-report">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header} scope="col">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length}>{emptyMessage}</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.key}>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.key}-${index + 1}`}>{cell}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="form-actions">
          <button data-variant="secondary" onClick={onPrintPaper} type="button">
            {paperActionLabel}
          </button>
          <button onClick={onPrintPdf} type="button">
            {pdfActionLabel}
          </button>
        </div>
      </div>
    ) : null}
  </details>
);

const ACCOUNT_HEADERS = ["Username", "Role", "Password"] as const;
const TEAM_HEADERS = ["Team Number", "Name", "Location"] as const;
const MATCH_HEADERS = [
  "Match ID",
  "Play #",
  "Field Type",
  "Score (R-B)",
  "Start Time",
] as const;
const SCHEDULE_HEADERS = [
  "Stage",
  "Match #",
  "Description",
  "Start Time",
] as const;

const buildAccountRows = (
  accounts: readonly PrintableAccountItem[]
): ReportTableRow[] =>
  accounts.map((account) => ({
    key: `${account.username}-${account.role}`,
    cells: [account.username, account.role, account.password ?? "-"],
  }));

const buildTeamRows = (teams: readonly PrintableTeamItem[]): ReportTableRow[] =>
  teams.map((team) => ({
    key: team.teamNumber,
    cells: [String(team.teamNumber), team.name, team.location || "-"],
  }));

const buildMatchRows = (
  matches: readonly PrintableMatchItem[]
): ReportTableRow[] =>
  matches.map((match) => ({
    key: match.matchId,
    cells: [
      match.matchId,
      String(match.playNumber),
      String(match.fieldType),
      `${match.redScore}-${match.blueScore}`,
      formatDateTimeValue(match.startTime),
    ],
  }));

const buildScheduleRows = (
  schedules: readonly PrintableScheduleItem[]
): ReportTableRow[] =>
  schedules.map((schedule, index) => ({
    key: `${schedule.stage}-${schedule.matchNumber ?? "na"}-${index}`,
    cells: [
      schedule.stage,
      schedule.matchNumber ?? "-",
      schedule.description || "-",
      formatDateTimeValue(schedule.startTime),
    ],
  }));

interface AccountsReportSectionProps {
  accounts: readonly PrintableAccountItem[];
  isMounted: boolean;
  onPrintPaper: () => void;
  onPrintPdf: () => void;
  onToggle: (nextEvent: SyntheticEvent<HTMLDetailsElement>) => void;
}

const AccountsReportSection = ({
  accounts,
  isMounted,
  onPrintPaper,
  onPrintPdf,
  onToggle,
}: AccountsReportSectionProps): JSX.Element => (
  <ReportTableSection
    count={accounts.length}
    emptyMessage="No accounts found."
    headers={ACCOUNT_HEADERS}
    isMounted={isMounted}
    onPrintPaper={onPrintPaper}
    onPrintPdf={onPrintPdf}
    onToggle={onToggle}
    open
    paperActionLabel="Print Accounts (Paper)"
    pdfActionLabel="Export Accounts (PDF)"
    rows={buildAccountRows(accounts)}
    summaryLabel="Accounts"
  />
);

interface TeamsReportSectionProps {
  isMounted: boolean;
  onPrintPaper: () => void;
  onPrintPdf: () => void;
  onToggle: (nextEvent: SyntheticEvent<HTMLDetailsElement>) => void;
  teams: readonly PrintableTeamItem[];
}

const TeamsReportSection = ({
  isMounted,
  onPrintPaper,
  onPrintPdf,
  onToggle,
  teams,
}: TeamsReportSectionProps): JSX.Element => (
  <ReportTableSection
    count={teams.length}
    emptyMessage="No teams found."
    headers={TEAM_HEADERS}
    isMounted={isMounted}
    onPrintPaper={onPrintPaper}
    onPrintPdf={onPrintPdf}
    onToggle={onToggle}
    paperActionLabel="Print Teams (Paper)"
    pdfActionLabel="Export Teams (PDF)"
    rows={buildTeamRows(teams)}
    summaryLabel="Teams"
  />
);

interface MatchesReportSectionProps {
  isMounted: boolean;
  matches: readonly PrintableMatchItem[];
  onPrintPaper: () => void;
  onPrintPdf: () => void;
  onToggle: (nextEvent: SyntheticEvent<HTMLDetailsElement>) => void;
}

const MatchesReportSection = ({
  isMounted,
  matches,
  onPrintPaper,
  onPrintPdf,
  onToggle,
}: MatchesReportSectionProps): JSX.Element => (
  <ReportTableSection
    count={matches.length}
    emptyMessage="No matches found."
    headers={MATCH_HEADERS}
    isMounted={isMounted}
    onPrintPaper={onPrintPaper}
    onPrintPdf={onPrintPdf}
    onToggle={onToggle}
    paperActionLabel="Print Matches (Paper)"
    pdfActionLabel="Export Matches (PDF)"
    rows={buildMatchRows(matches)}
    summaryLabel="Matches"
  />
);

interface ScheduleReportSectionProps {
  isMounted: boolean;
  onPrintPaper: () => void;
  onPrintPdf: () => void;
  onToggle: (nextEvent: SyntheticEvent<HTMLDetailsElement>) => void;
  schedules: readonly PrintableScheduleItem[];
}

const ScheduleReportSection = ({
  isMounted,
  onPrintPaper,
  onPrintPdf,
  onToggle,
  schedules,
}: ScheduleReportSectionProps): JSX.Element => (
  <ReportTableSection
    count={schedules.length}
    emptyMessage="No schedule entries found."
    headers={SCHEDULE_HEADERS}
    isMounted={isMounted}
    onPrintPaper={onPrintPaper}
    onPrintPdf={onPrintPdf}
    onToggle={onToggle}
    paperActionLabel="Print Schedule (Paper)"
    pdfActionLabel="Export Schedule (PDF)"
    rows={buildScheduleRows(schedules)}
    summaryLabel="Schedule"
  />
);

const useEventReportsPageController = ({
  eventCode,
  token,
}: EventReportsPageProps) => {
  const [state, dispatch] = useReducer(
    eventReportsPageReducer,
    eventReportsPageInitialState
  );

  useEffect(() => {
    let isCancelled = false;

    if (!token) {
      dispatch({
        type: "set",
        payload: {
          errorMessage: "You must be logged in to view event reports.",
          isLoading: false,
        },
      });
      return;
    }

    dispatch({
      type: "set",
      payload: {
        isAccountsMounted: true,
        isLoading: true,
        isMatchesMounted: false,
        isScheduleMounted: false,
        isTeamsMounted: false,
        errorMessage: null,
        printErrorMessage: null,
      },
    });

    fetchEventPrintLists(eventCode, token)
      .then((result) => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              reportData: result,
            },
          });
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              errorMessage:
                error instanceof Error
                  ? error.message
                  : "Failed to load printable reports.",
            },
          });
        }
      })
      .finally(() => {
        if (!isCancelled) {
          dispatch({
            type: "set",
            payload: {
              isLoading: false,
            },
          });
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token]);

  const reportData = state.reportData;

  const printAccounts = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          printErrorMessage: null,
        },
      });

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
        dispatch({
          type: "set",
          payload: {
            printErrorMessage: buildPrintErrorMessage(error),
          },
        });
      }
    },
    [eventCode, reportData]
  );

  const printTeams = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          printErrorMessage: null,
        },
      });

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
        dispatch({
          type: "set",
          payload: {
            printErrorMessage: buildPrintErrorMessage(error),
          },
        });
      }
    },
    [eventCode, reportData]
  );

  const printMatches = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          printErrorMessage: null,
        },
      });

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
        dispatch({
          type: "set",
          payload: {
            printErrorMessage: buildPrintErrorMessage(error),
          },
        });
      }
    },
    [eventCode, reportData]
  );

  const printSchedule = useCallback(
    (destination: PrintDestination): void => {
      if (!reportData) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          printErrorMessage: null,
        },
      });

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
        dispatch({
          type: "set",
          payload: {
            printErrorMessage: buildPrintErrorMessage(error),
          },
        });
      }
    },
    [eventCode, reportData]
  );

  const handleAccountsToggle = useCallback(
    (nextEvent: SyntheticEvent<HTMLDetailsElement>): void => {
      if (!nextEvent.currentTarget.open) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          isAccountsMounted: true,
        },
      });
    },
    []
  );

  const handleTeamsToggle = useCallback(
    (nextEvent: SyntheticEvent<HTMLDetailsElement>): void => {
      if (!nextEvent.currentTarget.open) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          isTeamsMounted: true,
        },
      });
    },
    []
  );

  const handleMatchesToggle = useCallback(
    (nextEvent: SyntheticEvent<HTMLDetailsElement>): void => {
      if (!nextEvent.currentTarget.open) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          isMatchesMounted: true,
        },
      });
    },
    []
  );

  const handleScheduleToggle = useCallback(
    (nextEvent: SyntheticEvent<HTMLDetailsElement>): void => {
      if (!nextEvent.currentTarget.open) {
        return;
      }

      dispatch({
        type: "set",
        payload: {
          isScheduleMounted: true,
        },
      });
    },
    []
  );

  const handlePrintAccountsPaper = useCallback((): void => {
    printAccounts("paper");
  }, [printAccounts]);

  const handlePrintAccountsPdf = useCallback((): void => {
    printAccounts("pdf");
  }, [printAccounts]);

  const handlePrintTeamsPaper = useCallback((): void => {
    printTeams("paper");
  }, [printTeams]);

  const handlePrintTeamsPdf = useCallback((): void => {
    printTeams("pdf");
  }, [printTeams]);

  const handlePrintMatchesPaper = useCallback((): void => {
    printMatches("paper");
  }, [printMatches]);

  const handlePrintMatchesPdf = useCallback((): void => {
    printMatches("pdf");
  }, [printMatches]);

  const handlePrintSchedulePaper = useCallback((): void => {
    printSchedule("paper");
  }, [printSchedule]);

  const handlePrintSchedulePdf = useCallback((): void => {
    printSchedule("pdf");
  }, [printSchedule]);

  return {
    handleAccountsToggle,
    handleMatchesToggle,
    handlePrintAccountsPaper,
    handlePrintAccountsPdf,
    handlePrintMatchesPaper,
    handlePrintMatchesPdf,
    handlePrintSchedulePaper,
    handlePrintSchedulePdf,
    handlePrintTeamsPaper,
    handlePrintTeamsPdf,
    handleScheduleToggle,
    handleTeamsToggle,
    state,
  };
};

interface EventReportsContentProps {
  eventCode: string;
  handlers: ReturnType<typeof useEventReportsPageController>;
  reportData: EventPrintListsResponse;
}

const EventReportsContent = ({
  eventCode,
  handlers,
  reportData,
}: EventReportsContentProps): JSX.Element => (
  <main className="page-shell page-shell--top">
    <section className="card surface-card surface-card--xlarge stack stack--compact">
      <header className="stack stack--tight">
        <h2 className="app-heading">Event Reports - {eventCode}</h2>
        <p className="app-subheading">
          Print to paper or export to PDF for account, team, match, and schedule
          lists.
        </p>
        <p className="form-note">
          Generated: {formatDateTimeValue(reportData.generatedAt)}
        </p>
      </header>

      {handlers.state.printErrorMessage ? (
        <p className="message-block" data-variant="danger" role="alert">
          {handlers.state.printErrorMessage}
        </p>
      ) : null}

      <AccountsReportSection
        accounts={reportData.accounts}
        isMounted={handlers.state.isAccountsMounted}
        onPrintPaper={handlers.handlePrintAccountsPaper}
        onPrintPdf={handlers.handlePrintAccountsPdf}
        onToggle={handlers.handleAccountsToggle}
      />

      <TeamsReportSection
        isMounted={handlers.state.isTeamsMounted}
        onPrintPaper={handlers.handlePrintTeamsPaper}
        onPrintPdf={handlers.handlePrintTeamsPdf}
        onToggle={handlers.handleTeamsToggle}
        teams={reportData.teams}
      />

      <MatchesReportSection
        isMounted={handlers.state.isMatchesMounted}
        matches={reportData.matches}
        onPrintPaper={handlers.handlePrintMatchesPaper}
        onPrintPdf={handlers.handlePrintMatchesPdf}
        onToggle={handlers.handleMatchesToggle}
      />

      <ScheduleReportSection
        isMounted={handlers.state.isScheduleMounted}
        onPrintPaper={handlers.handlePrintSchedulePaper}
        onPrintPdf={handlers.handlePrintSchedulePdf}
        onToggle={handlers.handleScheduleToggle}
        schedules={reportData.schedules}
      />

      <div className="form-actions">
        <a className="button" href={`/event/${eventCode}/dashboard`}>
          Back to Dashboard
        </a>
      </div>
    </section>
  </main>
);

export const EventReportsPage = ({
  eventCode,
  token,
}: EventReportsPageProps): JSX.Element => {
  const handlers = useEventReportsPageController({
    eventCode,
    token,
  });

  if (handlers.state.isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (handlers.state.errorMessage || !handlers.state.reportData) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {handlers.state.errorMessage ?? "Failed to load report data."}
          </p>
          <a className="app-link-inline" href={`/event/${eventCode}/dashboard`}>
            Back to Dashboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <EventReportsContent
      eventCode={eventCode}
      handlers={handlers}
      reportData={handlers.state.reportData}
    />
  );
};
