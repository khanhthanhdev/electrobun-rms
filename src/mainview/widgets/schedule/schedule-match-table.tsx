import { formatDisplayTime } from "./schedule-utils";

export interface ScheduleMatchRow {
  blueSurrogate: boolean;
  blueTeam: number;
  blueTeamName?: string;
  fieldNumber: number;
  matchLabel: string;
  matchNumber: number;
  redSurrogate: boolean;
  redTeam: number;
  redTeamName?: string;
  startTime: number;
}

interface ScheduleMatchTableProps {
  emptyMessage: string;
  matches: ScheduleMatchRow[];
}

const formatTeamDisplay = ({
  isSurrogate,
  teamName,
  teamNumber,
}: {
  isSurrogate: boolean;
  teamName?: string;
  teamNumber: number;
}): string => {
  const teamLabel = `#${teamNumber}${isSurrogate ? "*" : ""}`;
  const normalizedTeamName = teamName?.trim();

  return normalizedTeamName ? `${teamLabel} ${normalizedTeamName}` : teamLabel;
};

export const ScheduleMatchTable = ({
  matches,
  emptyMessage,
}: ScheduleMatchTableProps): JSX.Element => {
  if (matches.length === 0) {
    return <p className="form-note">{emptyMessage}</p>;
  }

  return (
    <table className="schedule-table">
      <thead>
        <tr>
          <th>Start</th>
          <th>Match</th>
          <th>Field</th>
          <th>Red</th>
          <th>Blue</th>
        </tr>
      </thead>
      <tbody>
        {matches.map((match) => (
          <tr key={match.matchNumber}>
            <td>{formatDisplayTime(match.startTime)}</td>
            <td>{match.matchLabel}</td>
            <td>{match.fieldNumber}</td>
            <td>
              {formatTeamDisplay({
                isSurrogate: match.redSurrogate,
                teamName: match.redTeamName,
                teamNumber: match.redTeam,
              })}
            </td>
            <td>
              {formatTeamDisplay({
                isSurrogate: match.blueSurrogate,
                teamName: match.blueTeamName,
                teamNumber: match.blueTeam,
              })}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
