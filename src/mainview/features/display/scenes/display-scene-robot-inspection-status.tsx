interface InspectionTeamRow {
  status: "NOT_STARTED" | "IN_PROGRESS" | "PASSED" | "READY" | "INCOMPLETE";
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
  READY: "Ready",
  INCOMPLETE: "Incomplete",
};

export const DisplaySceneRobotInspectionStatus = ({
  eventName,
  teams = [],
}: DisplaySceneRobotInspectionStatusProps): JSX.Element => (
  <div className="display-scene display-scene-inspection">
    <header className="display-inspection-header">
      <h2>Robot Inspection</h2>
    </header>
    <div className="display-inspection-table-wrap">
      <table className="display-inspection-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Team</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {teams.length > 0 ? (
            teams.map((row) => (
              <tr key={row.teamNumber}>
                <td
                  className={`display-inspection-status display-inspection-status--${row.status.toLowerCase().replace("_", "-")}`}
                >
                  {STATUS_LABELS[row.status] ?? row.status}
                </td>
                <td>{row.teamNumber}</td>
                <td>{row.teamName}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={3}>No teams</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
    <footer className="display-match-footer-label">{eventName}</footer>
  </div>
);
