import { useState } from "react";
import "../../../app/styles/components/inspection.css";
import { useInspectionRealtime } from "../../../features/inspection/hooks/use-inspection-realtime";
import { useInspectionTeams } from "../../../features/inspection/hooks/use-inspection-teams";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";

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
  useInspectionRealtime(eventCode, token);

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
    <main className="page-shell page-shell--top inspection-page-shell">
      <section className="card surface-card surface-card--xlarge stack inspection-page-card">
        <div className="inspection-header-layout">
          <div className="inspection-header-top-row">
            <a
              className="inspection-header-link"
              href={`/event/${eventCode}/inspection`}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(`/event/${eventCode}/inspection`);
              }}
            >
              <span className="hide-mobile">&lt;&lt; Back to Team Select</span>
              <span className="show-mobile">&lt;&lt; Back</span>
            </a>
            <div className="inspection-header-right-links" />
          </div>
          <h1 className="inspection-header-title">
            Robot Inspection Notes - {eventCode}
          </h1>
        </div>

        <div className="form-row" style={{ marginTop: "0.5rem" }}>
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

        {error ? (
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
        ) : null}

        <div className="table-wrap">
          <table className="inspection-teams-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: "10%" }}>
                  Team
                </th>
                <th scope="col" style={{ width: "30%" }}>
                  Name
                </th>
                <th scope="col" style={{ width: "15%", textAlign: "center" }}>
                  Status
                </th>
                <th scope="col" style={{ width: "45%" }}>
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {displayTeams.length > 0 ? (
                displayTeams.map((team) => (
                  <tr key={team.teamNumber}>
                    <td className="table-teams-team-number">
                      {team.teamNumber}
                    </td>
                    <td
                      className="table-teams-team-name"
                      title={team.teamName ?? ""}
                    >
                      {team.teamName ?? ""}
                    </td>
                    <td
                      className={`inspection-cell-status inspection-cell-status--${team.status}`}
                    >
                      {team.statusLabel}
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
