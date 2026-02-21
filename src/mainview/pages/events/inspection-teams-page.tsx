import { useMemo } from "react";
import "../../app/styles/components/inspection.css";
import { useInspectionTeams } from "../../features/inspection/hooks/use-inspection-teams";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import type { InspectionStatus } from "../../shared/types/inspection";

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
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--xlarge stack">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <a className="app-link-inline" href={`/event/${eventCode}`}>
              ← Back to Event
            </a>
            <h1 className="app-heading" style={{ marginTop: "0.5rem" }}>
              Robot Inspection — {eventCode}
            </h1>
          </div>
          <div
            style={{
              textAlign: "right",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              alignItems: "flex-end",
            }}
          >
            <a
              className="app-link-inline"
              href={`/event/${eventCode}/inspection/notes`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(`/event/${eventCode}/inspection/notes`);
              }}
            >
              View Notes
            </a>
            <a
              className="app-link-inline"
              href={`/event/${eventCode}/inspection/override`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(`/event/${eventCode}/inspection/override`);
              }}
            >
              Lead Inspector Override
            </a>
          </div>
        </div>

        <div className="inspection-legend">
          {STATUS_ORDER.map((status) => (
            <span
              className={`inspection-pill inspection-pill--${status}`}
              key={status}
            >
              {STATUS_LABELS[status]} ({statusCounts[status]})
            </span>
          ))}
        </div>

        <div className="inspection-progress-bar">
          {progressSegments.map((segment) => (
            <div
              className={`inspection-progress-segment inspection-progress-segment--${segment.status}`}
              key={segment.status}
              style={{ width: `${segment.percentage}%` }}
              title={`${STATUS_LABELS[segment.status]}: ${statusCounts[segment.status]}`}
            />
          ))}
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
          <table>
            <thead>
              <tr>
                <th scope="col">Team #</th>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                <th scope="col">Progress</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {teams.length > 0 ? (
                teams.map((team) => (
                  <tr key={team.teamNumber}>
                    <td className="table-teams-team-number">
                      {team.teamNumber}
                    </td>
                    <td>{team.teamName ?? "—"}</td>
                    <td>
                      <span
                        className={`inspection-pill inspection-pill--${team.status}`}
                      >
                        {team.statusLabel}
                      </span>
                    </td>
                    <td>
                      {team.progress.completedRequired}/
                      {team.progress.totalRequired}
                    </td>
                    <td>
                      <button
                        className="small outline"
                        onClick={() => {
                          onNavigate(
                            `/event/${eventCode}/inspection/${team.teamNumber}`
                          );
                        }}
                        type="button"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
