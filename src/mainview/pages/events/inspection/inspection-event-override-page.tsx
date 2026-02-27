import { useCallback, useEffect, useMemo, useState } from "react";
import "../../../app/styles/components/inspection.css";
import { useInspectionRealtime } from "../../../features/inspection/hooks/use-inspection-realtime";
import { useInspectionTeams } from "../../../features/inspection/hooks/use-inspection-teams";
import {
  patchInspectionStatus,
  postInspectionOverride,
} from "../../../features/inspection/services/inspection-service";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type { InspectionStatus } from "../../../shared/types/inspection";

interface InspectionEventOverridePageProps {
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

const OverrideTableRow = ({
  eventCode,
  team,
  token,
  onStatusChange,
}: {
  eventCode: string;
  team: {
    teamNumber: number;
    teamName?: string | null;
    status: InspectionStatus;
    statusLabel: string;
  };
  token: string | null;
  onStatusChange: (teamNumber: number, newStatus: InspectionStatus) => void;
}) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = () => setIsDropdownOpen(false);
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleStatusChange = async (newStatusStr: string) => {
    if (!token) {
      return;
    }
    setIsUpdating(true);
    setError(null);
    try {
      if (newStatusStr === "PASSED") {
        await postInspectionOverride(
          eventCode,
          team.teamNumber,
          "Lead inspector override from event page",
          token
        );
      } else {
        await patchInspectionStatus(
          eventCode,
          team.teamNumber,
          newStatusStr,
          token
        );
      }
      onStatusChange(team.teamNumber, newStatusStr as InspectionStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <tr>
      <td className="table-teams-team-number">{team.teamNumber}</td>
      <td className="table-teams-team-name" title={team.teamName ?? ""}>
        {team.teamName ?? "—"}
      </td>
      <td
        className={`inspection-cell-status inspection-cell-status--${team.status}`}
      >
        <div
          style={{
            position: "relative",
            display: "inline-block",
            width: "100%",
          }}
        >
          <button
            disabled={isUpdating}
            onClick={(e) => {
              e.stopPropagation();
              if (!isUpdating) {
                setIsDropdownOpen(!isDropdownOpen);
              }
            }}
            style={{
              width: "100%",
              padding: "4px 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: isUpdating ? "default" : "pointer",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: "4px",
              backgroundColor: "transparent",
            }}
            type="button"
          >
            <span>
              {STATUS_LABELS[team.status as InspectionStatus] ??
                team.statusLabel}
            </span>
            <svg
              aria-label="Toggle status menu"
              fill="none"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          {isDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                right: 0,
                backgroundColor: "white",
                color: "black",
                zIndex: 100,
                border: "1px solid #ccc",
                borderRadius: "4px",
                boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}
            >
              {STATUS_ORDER.map((status) => (
                <button
                  key={status}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStatusChange(status);
                    setIsDropdownOpen(false);
                  }}
                  style={{
                    padding: "8px",
                    cursor: "pointer",
                    borderBottom: "1px solid #eee",
                    backgroundColor:
                      team.status === status ? "#f0f0f0" : "transparent",
                    border: "none",
                    width: "100%",
                    textAlign: "left",
                  }}
                  type="button"
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>
        {isUpdating && (
          <span
            className="updating-spinner"
            style={{ marginLeft: "8px", fontSize: "12px" }}
          >
            Updating...
          </span>
        )}
        {error && (
          <div
            className="error-text"
            style={{ color: "red", fontSize: "12px" }}
          >
            {error}
          </div>
        )}
      </td>
    </tr>
  );
};

export const InspectionEventOverridePage = ({
  eventCode,
  onNavigate,
  token,
}: InspectionEventOverridePageProps): JSX.Element => {
  useInspectionRealtime(eventCode, token);

  const {
    error,
    isLoading,
    statusCounts,
    teams: initialTeams,
    totalTeams,
  } = useInspectionTeams(eventCode, token);

  const [localStatuses, setLocalStatuses] = useState<
    Record<number, InspectionStatus>
  >({});

  useEffect(() => {
    setLocalStatuses((previous) => {
      if (Object.keys(previous).length === 0) {
        return previous;
      }

      for (const team of initialTeams) {
        if (previous[team.teamNumber] !== undefined) {
          return {};
        }
      }

      return previous;
    });
  }, [initialTeams]);

  const handleStatusChange = useCallback(
    (teamNumber: number, newStatus: InspectionStatus) => {
      setLocalStatuses((prev) => ({ ...prev, [teamNumber]: newStatus }));
    },
    []
  );

  const progressSegments = useMemo(() => {
    if (totalTeams === 0) {
      return [];
    }

    const localStatusCounts = { ...statusCounts };
    // Apply local changes to the counts
    for (const [teamNumber, newStatus] of Object.entries(localStatuses)) {
      const team = initialTeams.find(
        (t) => t.teamNumber === Number(teamNumber)
      );
      if (team && team.status !== newStatus) {
        localStatusCounts[team.status]--;
        localStatusCounts[newStatus]++;
      }
    }

    return STATUS_ORDER.map((status) => ({
      status,
      percentage: (localStatusCounts[status] / totalTeams) * 100,
      count: localStatusCounts[status],
    })).filter((segment) => segment.percentage > 0);
  }, [statusCounts, totalTeams, localStatuses, initialTeams]);

  const teams = useMemo(() => {
    return initialTeams.map((team) => ({
      ...team,
      status: localStatuses[team.teamNumber] || team.status,
    }));
  }, [initialTeams, localStatuses]);

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
            Back to Team Select
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
            Robot Inspection Override - {eventCode}
          </h1>
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
                title={`${STATUS_LABELS[segment.status]}: ${segment.count}`}
              />
            ))}
            <div className="inspection-progress-bar-text">
              {totalTeams > 0 &&
              progressSegments.find((s) => s.status === "PASSED")
                ? `${Math.round(progressSegments.find((s) => s.status === "PASSED")?.percentage ?? 0)}% Passed`
                : null}
            </div>
          </div>
        </div>

        <div className="form-row">
          <p>Set the status of each team:</p>
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
              </tr>
            </thead>
            <tbody>
              {teams.length > 0 ? (
                teams.map((team) => (
                  <OverrideTableRow
                    eventCode={eventCode}
                    key={team.teamNumber}
                    onStatusChange={handleStatusChange}
                    team={team}
                    token={token}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No teams found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};
