import type React from "react";
import type { ControlMatchRow } from "../../../shared/types/match-control";

interface ControlScheduleTableProps {
  emptyMessage: string;
  eventCode: string;
  onLoadMatch?: (matchNumber: number) => void;
  onNavigate: (path: string) => void;
  rows: ControlMatchRow[];
}

const toTeamLabel = (
  teamNumber: number,
  teamName: string,
  isSurrogate: boolean
): string => {
  const suffix = isSurrogate ? "*" : "";
  const normalizedName = teamName.trim();
  return normalizedName
    ? `#${teamNumber}${suffix} ${normalizedName}`
    : `#${teamNumber}${suffix}`;
};

const toStateClassName = (state: ControlMatchRow["state"]): string => {
  if (state === "COMMITTED") {
    return "match-control-state-badge--committed";
  }
  if (state === "INCOMPLETE") {
    return "match-control-state-badge--incomplete";
  }
  return "match-control-state-badge--unplayed";
};

const toStateLabel = (state: ControlMatchRow["state"]): string => {
  if (state === "COMMITTED") {
    return "Committed";
  }
  if (state === "INCOMPLETE") {
    return "Incomplete";
  }
  return "Unplayed";
};

const createClickHandler = (
  event: React.MouseEvent,
  onNavigate: (path: string) => void,
  path: string
): void => {
  event.preventDefault();
  onNavigate(path);
};

const MatchActions = ({
  eventCode,
  onLoadMatch,
  onNavigate,
  row,
}: {
  eventCode: string;
  onLoadMatch?: (matchNumber: number) => void;
  onNavigate: (path: string) => void;
  row: ControlMatchRow;
}): JSX.Element => {
  const scoresheetPath = `/event/${eventCode}/match/${row.matchName}`;
  const historyPath = `/event/${eventCode}/match/${row.matchName}/history`;
  const redEntryPath = `/event/${eventCode}/ref/red/scoring/${row.fieldNumber}/match/${row.matchNumber}`;
  const blueEntryPath = `/event/${eventCode}/ref/blue/scoring/${row.fieldNumber}/match/${row.matchNumber}`;

  if (row.state === "COMMITTED") {
    return (
      <div className="match-control-table-links">
        <button
          className="match-control-table-action match-control-table-action--replay"
          onClick={() => onLoadMatch?.(row.matchNumber)}
          type="button"
        >
          [Replay]
        </button>
        <a
          href={scoresheetPath}
          onClick={(event) =>
            createClickHandler(event, onNavigate, scoresheetPath)
          }
        >
          [Edit]
        </a>
        <button className="match-control-table-action" type="button">
          [Post]
        </button>
      </div>
    );
  }

  if (row.state === "UNPLAYED") {
    return (
      <div className="match-control-table-links">
        <button
          className="match-control-table-action match-control-table-action--play"
          onClick={() => onLoadMatch?.(row.matchNumber)}
          type="button"
        >
          [Play]
        </button>
        <a
          href={redEntryPath}
          onClick={(event) =>
            createClickHandler(event, onNavigate, redEntryPath)
          }
        >
          [Enter Scores]
        </a>
      </div>
    );
  }

  return (
    <div className="match-control-table-links">
      <a
        href={scoresheetPath}
        onClick={(event) =>
          createClickHandler(event, onNavigate, scoresheetPath)
        }
      >
        [Scoresheet]
      </a>
      <a
        href={historyPath}
        onClick={(event) => createClickHandler(event, onNavigate, historyPath)}
      >
        [History]
      </a>
      <a
        href={redEntryPath}
        onClick={(event) => createClickHandler(event, onNavigate, redEntryPath)}
      >
        [Red Ref]
      </a>
      <a
        href={blueEntryPath}
        onClick={(event) =>
          createClickHandler(event, onNavigate, blueEntryPath)
        }
      >
        [Blue Ref]
      </a>
    </div>
  );
};

export const ControlScheduleTable = ({
  emptyMessage,
  eventCode,
  onLoadMatch,
  onNavigate,
  rows,
}: ControlScheduleTableProps): JSX.Element => (
  <div className="table-wrap">
    <table className="match-control-table">
      <thead>
        <tr>
          <th>Match</th>
          <th>Round</th>
          <th>Field</th>
          <th>State</th>
          <th>Red</th>
          <th className="match-control-score-cell">Red Score</th>
          <th className="match-control-score-cell">Blue Score</th>
          <th>Blue</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="match-control-empty-cell" colSpan={9}>
              {emptyMessage}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.matchName}>
              <td>{row.matchName}</td>
              <td className="match-control-number">{row.roundNumber}</td>
              <td className="match-control-number">{row.fieldNumber}</td>
              <td>
                <span
                  className={`match-control-state-badge ${toStateClassName(row.state)}`}
                >
                  {toStateLabel(row.state)}
                </span>
              </td>
              <td className="match-control-red-team">
                {toTeamLabel(row.redTeam, row.redTeamName, row.redSurrogate)}
              </td>
              <td className="match-control-score-cell">
                {row.redScore === null ? "-" : row.redScore}
              </td>
              <td className="match-control-score-cell">
                {row.blueScore === null ? "-" : row.blueScore}
              </td>
              <td className="match-control-blue-team">
                {toTeamLabel(row.blueTeam, row.blueTeamName, row.blueSurrogate)}
              </td>
              <td>
                <MatchActions
                  eventCode={eventCode}
                  onLoadMatch={onLoadMatch}
                  onNavigate={onNavigate}
                  row={row}
                />
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);
