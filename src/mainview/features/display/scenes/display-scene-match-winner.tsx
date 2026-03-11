import { DisplayChrome } from "../display-chrome";
import type { ScoreBreakdown } from "../use-display-data";

interface MatchWinnerData {
  blueBreakdown: ScoreBreakdown | null;
  blueScore: number;
  blueTeam: number;
  blueTeamName: string;
  matchName: string;
  redBreakdown: ScoreBreakdown | null;
  redScore: number;
  redTeam: number;
  redTeamName: string;
}

interface DisplaySceneMatchWinnerProps {
  eventName: string;
  match?: MatchWinnerData | null;
}

const BREAKDOWN_LABELS: Array<{ key: keyof ScoreBreakdown; label: string }> = [
  { key: "a", label: "A" },
  { key: "b", label: "B" },
  { key: "c", label: "C" },
  { key: "d", label: "D" },
];

const BreakdownTable = ({
  blue,
  red,
}: {
  blue: ScoreBreakdown | null;
  red: ScoreBreakdown | null;
}): JSX.Element | null => {
  if (!(red || blue)) {
    return null;
  }
  return (
    <table className="display-winner-breakdown-table">
      <tbody>
        {BREAKDOWN_LABELS.map(({ key, label }) => (
          <tr key={key}>
            <td className="display-winner-breakdown-red">{red?.[key] ?? 0}</td>
            <td className="display-winner-breakdown-label">{label}</td>
            <td className="display-winner-breakdown-blue">
              {blue?.[key] ?? 0}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const DisplaySceneMatchWinner = ({
  eventName,
  match,
}: DisplaySceneMatchWinnerProps): JSX.Element => {
  const redScore = match?.redScore ?? 0;
  const blueScore = match?.blueScore ?? 0;
  const isTie = redScore === blueScore;
  const redWon = !isTie && redScore > blueScore;
  const blueWon = !isTie && blueScore > redScore;

  return (
    <DisplayChrome eventName={eventName}>
      <div className="display-scene display-scene-match-winner">
        <div className="display-scene-header-row">
          <h2>Match Results</h2>
          <span>{match?.matchName ?? "—"}</span>
        </div>
        <div className="display-winner-score-area">
          <div
            className={`display-winner-alliance display-winner-red ${redWon ? "display-winner-alliance--won" : ""}`}
          >
            <span className="display-winner-team">
              {match?.redTeam ?? "—"} {match?.redTeamName ?? ""}
            </span>
            <span className="display-winner-score">{redScore}</span>
            {redWon ? (
              <span className="display-winner-badge">WINNER</span>
            ) : null}
          </div>

          <BreakdownTable
            blue={match?.blueBreakdown ?? null}
            red={match?.redBreakdown ?? null}
          />

          {isTie ? <span className="display-winner-badge">TIE</span> : null}

          <div
            className={`display-winner-alliance display-winner-blue ${blueWon ? "display-winner-alliance--won" : ""}`}
          >
            <span className="display-winner-team">
              {match?.blueTeam ?? "—"} {match?.blueTeamName ?? ""}
            </span>
            <span className="display-winner-score">{blueScore}</span>
            {blueWon ? (
              <span className="display-winner-badge">WINNER</span>
            ) : null}
          </div>
        </div>
      </div>
    </DisplayChrome>
  );
};
