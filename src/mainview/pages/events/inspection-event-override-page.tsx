import { useCallback, useMemo, useState } from "react";
import "../../app/styles/components/inspection.css";
import { useInspectionTeams } from "../../features/inspection/hooks/use-inspection-teams";
import {
  patchInspectionStatus,
  postInspectionOverride,
} from "../../features/inspection/services/inspection-service";
import { LoadingIndicator } from "../../shared/components/loading-indicator";
import type { InspectionStatus } from "../../shared/types/inspection";

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
      <td>{team.teamName ?? "—"}</td>
      <td
        className={`inspection-override-status-cell inspection-override-status-cell--${team.status.replace("_", "-").toLowerCase()}`}
        style={{
          backgroundColor: `var(--status-${team.status.replace("_", "-").toLowerCase()})`,
        }}
      >
        <div
          className="select-wrap"
          style={{ display: "inline-block", width: "auto" }}
        >
          <select
            disabled={isUpdating}
            onChange={(e) => handleStatusChange(e.currentTarget.value)}
            style={{ width: "100%" }}
            value={team.status}
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
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
    <main className="page-shell page-shell--top">
      <section className="card surface-card surface-card--xlarge stack">
        <a
          className="app-link-inline"
          href={`/event/${eventCode}/inspection`}
          onClick={(e) => {
            e.preventDefault();
            onNavigate(`/event/${eventCode}/inspection`);
          }}
        >
          ← Back to Team Select
        </a>

        <div className="inspection-detail-header">
          <h1 className="app-heading">Robot Inspection — {eventCode}</h1>
        </div>

        <div className="inspection-legend">
          {STATUS_ORDER.map((status) => {
            const currentCount =
              progressSegments.find((s) => s.status === status)?.count || 0;
            return (
              <span
                className={`inspection-pill inspection-pill--${status}`}
                key={status}
              >
                {STATUS_LABELS[status]} ({currentCount})
              </span>
            );
          })}
        </div>

        <div className="inspection-progress-bar">
          {progressSegments.map((segment) => (
            <div
              className={`inspection-progress-segment inspection-progress-segment--${segment.status}`}
              key={segment.status}
              style={{ width: `${segment.percentage}%` }}
              title={`${STATUS_LABELS[segment.status]}: ${segment.count}`}
            />
          ))}
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
          <table>
            <thead>
              <tr>
                <th scope="col">Team #</th>
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
