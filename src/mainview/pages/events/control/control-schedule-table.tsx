import type React from "react";
import type { ControlMatchRow } from "../../../shared/types/match-control";

interface ControlScheduleTableProps {
  emptyMessage: string;
  eventCode: string;
  onLoadMatch?: (matchNumber: number) => void;
  onNavigate: (path: string) => void;
  onResetScore?: (row: ControlMatchRow) => void;
  onShowResults?: (row: ControlMatchRow) => void;
  rows: ControlMatchRow[];
  selectedMatch?: Pick<ControlMatchRow, "matchNumber" | "matchType"> | null;
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

const isSelectedRow = (
  row: ControlMatchRow,
  selectedMatch: Pick<ControlMatchRow, "matchNumber" | "matchType"> | null
): boolean =>
  selectedMatch !== null &&
  row.matchNumber === selectedMatch.matchNumber &&
  row.matchType === selectedMatch.matchType;

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
  isBusy,
  onLoadMatch,
  onNavigate,
  onResetScore,
  onShowResults,
  row,
}: {
  eventCode: string;
  /**
   * True if this row is the currently loaded or active match. When busy we
   * hide Play/Replay/Reset because those operations are owned by the active
   * match panel and the match-control state machine.
   */
  isBusy: boolean;
  onLoadMatch?: (matchNumber: number) => void;
  onNavigate: (path: string) => void;
  onResetScore?: (row: ControlMatchRow) => void;
  onShowResults?: (row: ControlMatchRow) => void;
  row: ControlMatchRow;
}): JSX.Element => {
  const scoresheetPath = `/event/${eventCode}/match/${row.matchName}`;
  const historyPath = `/event/${eventCode}/match/${row.matchName}/history`;
  const redEntryPath = `/event/${eventCode}/ref/red/scoring/${row.fieldNumber}/${row.matchType}/match/${row.matchNumber}`;
  const blueEntryPath = `/event/${eventCode}/ref/blue/scoring/${row.fieldNumber}/${row.matchType}/match/${row.matchNumber}`;

  // Play / Replay button — present for any row that is not the currently
  // loaded or active match. Label depends on whether scores already exist.
  // - UNPLAYED  → [Play]   (no scores yet)
  // - INCOMPLETE → [Play]  (load path clears saved scores before staging)
  // - COMMITTED → [Replay] (load path clears saved scores before staging)
  let playLabel: string | null = null;
  let playClass = "match-control-table-action--play";
  if (!isBusy) {
    if (row.state === "UNPLAYED" || row.state === "INCOMPLETE") {
      playLabel = "Play";
    } else if (row.state === "COMMITTED") {
      playLabel = "Replay";
      playClass = "match-control-table-action--replay";
    }
  }

  // Reset Score button — visible whenever there are saved scores to wipe.
  const canReset =
    !isBusy &&
    onResetScore !== undefined &&
    (row.state === "INCOMPLETE" || row.state === "COMMITTED");

  return (
    <div className="match-control-table-links">
      {playLabel ? (
        <button
          className={`match-control-table-action ${playClass}`}
          onClick={() => onLoadMatch?.(row.matchNumber)}
          type="button"
        >
          [{playLabel}]
        </button>
      ) : null}

      {canReset ? (
        <button
          className="match-control-table-action match-control-table-action--reset"
          onClick={() => onResetScore?.(row)}
          type="button"
        >
          [Reset Score]
        </button>
      ) : null}

      {row.state === "COMMITTED" ? (
        <>
          {onShowResults ? (
            <button
              className="match-control-table-action match-control-table-action--show-results"
              onClick={() => onShowResults(row)}
              type="button"
            >
              [Show Results]
            </button>
          ) : null}
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
            onClick={(event) =>
              createClickHandler(event, onNavigate, historyPath)
            }
          >
            [History]
          </a>
          <a
            href={redEntryPath}
            onClick={(event) =>
              createClickHandler(event, onNavigate, redEntryPath)
            }
          >
            [Edit Red]
          </a>
          <a
            href={blueEntryPath}
            onClick={(event) =>
              createClickHandler(event, onNavigate, blueEntryPath)
            }
          >
            [Edit Blue]
          </a>
        </>
      ) : (
        <>
          <a
            href={redEntryPath}
            onClick={(event) =>
              createClickHandler(event, onNavigate, redEntryPath)
            }
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
        </>
      )}
    </div>
  );
};

export const ControlScheduleTable = ({
  emptyMessage,
  eventCode,
  onLoadMatch,
  onNavigate,
  onResetScore,
  onShowResults,
  rows,
  selectedMatch = null,
}: ControlScheduleTableProps): JSX.Element => (
  <div className="table-wrap">
    <table className="match-control-table">
      <thead>
        <tr>
          <th>Match</th>
          <th>Round</th>
          <th>Field</th>
          <th>State</th>
          <th>Blue</th>
          <th className="match-control-score-cell">Blue Score</th>
          <th className="match-control-score-cell">Red Score</th>
          <th>Red</th>
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
            <tr
              className={
                isSelectedRow(row, selectedMatch)
                  ? "match-control-table-row--selected"
                  : undefined
              }
              key={row.matchName}
            >
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
              <td className="match-control-blue-team">
                {toTeamLabel(row.blueTeam, row.blueTeamName, row.blueSurrogate)}
              </td>
              <td className="match-control-score-cell">
                {row.blueScore === null ? "-" : row.blueScore}
              </td>
              <td className="match-control-score-cell">
                {row.redScore === null ? "-" : row.redScore}
              </td>
              <td className="match-control-red-team">
                {toTeamLabel(row.redTeam, row.redTeamName, row.redSurrogate)}
              </td>
              <td>
                <MatchActions
                  eventCode={eventCode}
                  isBusy={isSelectedRow(row, selectedMatch)}
                  onLoadMatch={onLoadMatch}
                  onNavigate={onNavigate}
                  onResetScore={onResetScore}
                  onShowResults={onShowResults}
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
