import { useMemo } from "react";
import "../../../app/styles/components/inspection.css";
import { useInspectionRealtime } from "../../../features/inspection/hooks/use-inspection-realtime";
import { useInspectionTeams } from "../../../features/inspection/hooks/use-inspection-teams";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type { InspectionStatus } from "../../../shared/types/inspection";

interface InspectionTeamsPageProps {
  eventCode: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

const STATUS_LABELS: Record<InspectionStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  INCOMPLETE: "Incomplete",
  PASSED: "Passed",
};

const STATUS_ORDER: InspectionStatus[] = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "INCOMPLETE",
  "PASSED",
];

export const InspectionTeamsPage = ({
  eventCode,
  onNavigate,
  token,
}: InspectionTeamsPageProps): JSX.Element => {
  useInspectionRealtime(eventCode, token);

  const {
    error,
    isLoading,
    search,
    setSearch,
    statusCounts,
    teams,
    totalTeams,
  } = useInspectionTeams(eventCode, token);

  const progressSegments = useMemo(() => {
    if (totalTeams === 0) {
      return [];
    }
    return STATUS_ORDER.map((status) => ({
      status,
      percentage: (statusCounts[status] / totalTeams) * 100,
    })).filter((segment) => segment.percentage > 0);
  }, [statusCounts, totalTeams]);

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (error && teams.length === 0) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
          <a className="app-link-inline" href={`/event/${eventCode}`}>
            Back to Event
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top inspection-page-shell">
      <section className="card surface-card surface-card--xlarge stack inspection-page-card">
        <div className="inspection-header-layout">
          <div className="inspection-header-top-row">
            <a className="inspection-header-link" href={`/event/${eventCode}`}>
              <span className="hide-mobile">&lt;&lt; Back to Event Home</span>
              <span className="show-mobile">&lt;&lt; Back</span>
            </a>
            <div className="inspection-header-right-links">
              <a
                className="inspection-header-link"
                href={`/event/${eventCode}/inspection/override`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(`/event/${eventCode}/inspection/override`);
                }}
              >
                Lead Inspector Override
              </a>
              <a
                className="inspection-header-link"
                href={`/event/${eventCode}/inspection/notes`}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(`/event/${eventCode}/inspection/notes`);
                }}
              >
                View Inspection Notes
              </a>
            </div>
          </div>
          <h1 className="inspection-header-title">Inspection - {eventCode}</h1>
        </div>

        <div className="inspection-legend-section">
          <div className="inspection-legend-label">Legend:</div>
          <div className="inspection-legend-grid">
            <div className="inspection-legend-cell inspection-legend-cell--NOT_STARTED">
              Not Started
            </div>
            <div className="inspection-legend-cell inspection-legend-cell--IN_PROGRESS">
              In Progress
            </div>
            <div className="inspection-legend-cell inspection-legend-cell--PASSED">
              Passed
            </div>
            <div className="inspection-legend-cell inspection-legend-cell--INCOMPLETE">
              Incomplete
            </div>
          </div>

          <div className="inspection-progress-bar-container">
            {progressSegments.map((segment) => (
              <div
                className={`inspection-progress-segment inspection-progress-segment--${segment.status}`}
                key={segment.status}
                style={{ width: `${segment.percentage}%` }}
                title={`${STATUS_LABELS[segment.status]}: ${statusCounts[segment.status]}`}
              />
            ))}
            <div className="inspection-progress-bar-text">
              {totalTeams > 0 && statusCounts.PASSED > 0
                ? `${Math.round((statusCounts.PASSED / totalTeams) * 100)}% Passed`
                : null}
            </div>
          </div>
        </div>

        <div className="form-row">
          <label htmlFor="inspection-search">Search teams</label>
          <input
            id="inspection-search"
            onChange={(event) => {
              setSearch(event.currentTarget.value);
            }}
            placeholder="Search by team number or name"
            type="search"
            value={search}
          />
        </div>

        {error ? (
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="inspection-teams-table">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {teams.length > 0 ? (
                teams.map((team) => (
                  <tr key={team.teamNumber}>
                    <td className="table-teams-team-number">
                      {team.teamNumber}
                    </td>
                    <td
                      className="table-teams-team-name"
                      title={team.teamName ?? ""}
                    >
                      {team.teamName ?? "—"}
                    </td>
                    <td
                      className={`inspection-cell-status inspection-cell-status--${team.status}`}
                    >
                      {team.statusLabel}
                    </td>
                    <td className="inspection-cell-action">
                      <a
                        className="inspection-action-link"
                        href={`/event/${eventCode}/inspection/${team.teamNumber}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(
                            `/event/${eventCode}/inspection/${team.teamNumber}`
                          );
                        }}
                      >
                        Inspect
                      </a>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
