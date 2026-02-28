import "../results/match-results.css";
import { useMatchHistory } from "../../../features/scoring/hooks/use-match-results";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type {
  MatchHistoryEventItem,
  MatchType,
} from "../../../shared/types/scoring";

interface MatchHistoryEmbedProps {
  eventCode: string;
  matchName: string;
  matchNumber: number;
  matchType: MatchType;
  token: string | null;
}

const formatDate = (ts: number): string =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));

export const MatchHistoryEmbed = ({
  eventCode,
  matchName,
  matchNumber,
  matchType,
  token,
}: MatchHistoryEmbedProps): JSX.Element => {
  const { history, isLoading, error } = useMatchHistory(
    eventCode,
    matchType,
    matchNumber,
    token,
    true
  );

  if (error) {
    return (
      <p className="message-block" data-variant="danger" role="alert">
        {error}
      </p>
    );
  }

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <div className="match-control-embed-history">
      <p className="text-center text-muted" style={{ marginBottom: "1rem" }}>
        Most Recent First
      </p>
      <div className="table-responsive">
        <table className="match-results-table">
          <thead>
            <tr>
              <th>Type / Alliance</th>
              <th>Time</th>
              <th className="score-col">Red Score</th>
              <th className="score-col">Blue Score</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 ? (
              <tr>
                <td className="empty-message text-center" colSpan={4}>
                  No history found for {matchName}.
                </td>
              </tr>
            ) : (
              history.map((entry: MatchHistoryEventItem, idx: number) => {
                const redWon =
                  entry.redScore !== null &&
                  entry.blueScore !== null &&
                  entry.redScore > entry.blueScore;
                const blueWon =
                  entry.redScore !== null &&
                  entry.blueScore !== null &&
                  entry.blueScore > entry.redScore;

                return (
                  <tr key={`${entry.ts}-${entry.type}-${idx}`}>
                    <td>{entry.type}</td>
                    <td>{formatDate(entry.ts)}</td>
                    <td
                      className={`score-cell ${redWon ? "highlight-red" : ""}`}
                    >
                      {entry.redScore ?? "-"}
                    </td>
                    <td
                      className={`score-cell ${
                        blueWon ? "highlight-blue" : ""
                      }`}
                    >
                      {entry.blueScore ?? "-"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
