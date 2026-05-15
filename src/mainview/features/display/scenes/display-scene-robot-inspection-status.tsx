import { useEffect, useMemo, useRef } from "react";
import type { InspectionStatus } from "@/shared/types/inspection";
import { DisplaySceneFooter } from "../components/display-scene-footer";
import { DisplaySceneHeader } from "../components/display-scene-header";

interface InspectionTeamRow {
  status: InspectionStatus;
  teamName: string;
  teamNumber: number;
}

interface DisplaySceneRobotInspectionStatusProps {
  eventName: string;
  teams?: InspectionTeamRow[];
}

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  PASSED: "Passed",
  INCOMPLETE: "Incomplete",
};

const STATUS_LEGEND: Array<{
  className: string;
  label: string;
  status: string;
}> = [
  { status: "NOT_STARTED", label: "Not Started", className: "not-started" },
  { status: "IN_PROGRESS", label: "In Progress", className: "in-progress" },
  { status: "INCOMPLETE", label: "Incomplete", className: "incomplete" },
  { status: "PASSED", label: "Passed", className: "passed" },
];

const SCROLL_SPEED = 1; // pixels per frame
const SCROLL_PAUSE_MS = 2000; // pause at bottom before returning to top

const renderInspectionTable = (
  rows: InspectionTeamRow[],
  emptyLabel?: string
): JSX.Element => (
  <table className="display-inspection-table">
    <thead>
      <tr>
        <th scope="col">Status</th>
        <th scope="col">Team Number</th>
        <th scope="col">Team Name</th>
      </tr>
    </thead>
    <tbody>
      {rows.length > 0 ? (
        rows.map((row) => (
          <tr key={row.teamNumber}>
            <td>
              <span
                className={`display-inspection-status display-inspection-status--${row.status.toLowerCase().replaceAll("_", "-")}`}
              >
                {STATUS_LABELS[row.status] ?? row.status}
              </span>
            </td>
            <td>{row.teamNumber}</td>
            <td>{row.teamName}</td>
          </tr>
        ))
      ) : (
        <tr>
          <td className="display-inspection-empty" colSpan={3}>
            {emptyLabel ?? ""}
          </td>
        </tr>
      )}
    </tbody>
  </table>
);

export const DisplaySceneRobotInspectionStatus = ({
  eventName,
  teams = [],
}: DisplaySceneRobotInspectionStatusProps): JSX.Element => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number>();
  const pauseTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const splitIndex = Math.ceil(teams.length / 2);
  const leftTeams = teams.slice(0, splitIndex);
  const rightTeams = teams.slice(splitIndex);
  const teamsKey = useMemo(
    () =>
      teams
        .map((team) => `${team.teamNumber}:${team.teamName}:${team.status}`)
        .join("|"),
    [teams]
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || teams.length === 0) {
      return;
    }

    let isPaused = false;
    el.scrollTop = 0;

    const scrollStep = () => {
      if (isPaused) {
        animationRef.current = requestAnimationFrame(scrollStep);
        return;
      }

      const { scrollTop, scrollHeight, clientHeight } = el;
      const maxScroll = scrollHeight - clientHeight;

      if (maxScroll <= 0) {
        return;
      }

      const nextScroll = scrollTop + SCROLL_SPEED;

      if (nextScroll >= maxScroll) {
        el.scrollTop = maxScroll;
        isPaused = true;
        pauseTimeoutRef.current = setTimeout(() => {
          el.scrollTop = 0;
          isPaused = false;
        }, SCROLL_PAUSE_MS);
      } else {
        el.scrollTop = nextScroll;
      }

      animationRef.current = requestAnimationFrame(scrollStep);
    };

    animationRef.current = requestAnimationFrame(scrollStep);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, [teams.length, teamsKey]);

  return (
    <section
      aria-label={`${eventName} robot inspection status scene`}
      className="display-inspection-scene"
    >
      <DisplaySceneHeader title="Robot Inspection" />

      <main className="display-inspection-main">
        <div className="display-inspection-table-container">
          <div className="display-inspection-table-scroll" ref={scrollRef}>
            <div className="display-inspection-table-grid">
              {renderInspectionTable(leftTeams, "No teams")}
              {renderInspectionTable(rightTeams)}
            </div>
          </div>
        </div>

        <div className="display-inspection-legend">
          <span className="display-inspection-legend-title">Status Key:</span>
          {STATUS_LEGEND.map((item) => (
            <span
              className="display-inspection-legend-item"
              key={item.status}
            >
              <span
                className={`display-inspection-legend-dot display-inspection-legend-dot--${item.className}`}
              />
              {item.label}
            </span>
          ))}
        </div>
      </main>

      <DisplaySceneFooter />
    </section>
  );
};
