import { useState } from "react";
import "../../app/styles/components/inspection.css";
import { useInspectionTeams } from "../../features/inspection/hooks/use-inspection-teams";
import { LoadingIndicator } from "../../shared/components/loading-indicator";

interface InspectionNotesPageProps {
  eventCode: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

export const InspectionNotesPage = ({
  eventCode,
  onNavigate,
  token,
}: InspectionNotesPageProps): JSX.Element => {
  const { error, isLoading, teams } = useInspectionTeams(eventCode, token);
  const [isCondensed, setIsCondensed] = useState(false);

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
          <a
            className="app-link-inline"
            href={`/event/${eventCode}/inspection`}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(`/event/${eventCode}/inspection`);
            }}
          >
            &lt;&lt; Back to Team Select
          </a>
        </div>
      </main>
    );
  }

  const displayTeams = isCondensed
    ? teams.filter((t) => t.comment && t.comment.trim() !== "")
    : teams;

  return (
    <main className="page-shell page-shell--top">
      <section
        className="card surface-card surface-card--xlarge stack"
        style={{ paddingTop: "1rem" }}
      >
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            <a
              className="app-link-inline"
              href={`/event/${eventCode}/inspection`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(`/event/${eventCode}/inspection`);
              }}
            >
              &lt;&lt; Back to Team Select
            </a>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.25rem",
                fontSize: "0.875rem",
              }}
            >
              <input
                checked={isCondensed}
                onChange={(e) => setIsCondensed(e.target.checked)}
                type="checkbox"
              />
              Condensed
            </label>
          </div>

          <h1
            className="app-heading"
            style={{ textAlign: "center", margin: 0 }}
          >
            Robot Inspection Notes - {eventCode}
          </h1>
        </div>

        {error ? (
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="table-wrap" style={{ marginTop: "2rem" }}>
          <table>
            <thead>
              <tr>
                <th scope="col" style={{ width: "10%", textAlign: "center" }}>
                  Team
                </th>
                <th scope="col" style={{ width: "30%", textAlign: "center" }}>
                  Name
                </th>
                <th scope="col" style={{ width: "15%", textAlign: "center" }}>
                  Status
                </th>
                <th scope="col" style={{ width: "45%", textAlign: "center" }}>
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {displayTeams.length > 0 ? (
                displayTeams.map((team) => (
                  <tr key={team.teamNumber}>
                    <td
                      className="table-teams-team-number"
                      style={{ textAlign: "center" }}
                    >
                      {team.teamNumber}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {team.teamName ?? ""}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        className={`inspection-pill inspection-pill--${team.status}`}
                      >
                        {team.statusLabel}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {team.comment ?? ""}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center" }}>
                    No teams found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
