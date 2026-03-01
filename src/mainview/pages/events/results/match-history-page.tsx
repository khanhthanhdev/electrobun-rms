import type React from "react";
import { useMatchHistory } from "../../../features/scoring/hooks/use-match-results";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type {
  MatchHistoryEventItem,
  MatchType,
} from "../../../shared/types/scoring";

interface MatchHistoryPageProps {
  eventCode: string;
  matchName: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

const MATCH_NAME_REGEX = /^([QEP])(\d+)$/i;

const parseMatchName = (
  matchName: string
): { matchType: MatchType; matchNumber: number } | null => {
  const match = MATCH_NAME_REGEX.exec(matchName);
  if (!match) {
    return null;
  }

  const typeKey = match[1].toUpperCase();
  let type: MatchType = "elims";
  if (typeKey === "P") {
    type = "practice";
  } else if (typeKey === "Q") {
    type = "quals";
  }
  const num = Number.parseInt(match[2], 10);

  if (Number.isNaN(num) || num <= 0) {
    return null;
  }

  return { matchType: type, matchNumber: num };
};

const formatDate = (ts: number) => {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(ts));
};

export const MatchHistoryPage = ({
  eventCode,
  matchName,
  onNavigate,
  token,
}: MatchHistoryPageProps): JSX.Element => {
  const parsed = parseMatchName(matchName);

  const { history, isLoading, error } = useMatchHistory(
    eventCode,
    parsed?.matchType ?? "quals",
    parsed?.matchNumber ?? 0,
    token,
    parsed !== null
  );

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(`/event/${eventCode}/results`);
  };

  if (!parsed) {
    return (
      <main className="page-shell">
        <div className="card surface-card">
          <p className="message-block" data-variant="danger">
            Invalid match name: {matchName}
          </p>
          <a
            className="app-link-inline"
            href={`/event/${eventCode}/results`}
            onClick={handleBack}
          >
            Back to Match Results
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="card surface-card match-results-container">
        <header className="match-results-header">
          <a
            className="app-link-inline match-results-back"
            href={`/event/${eventCode}/results`}
            onClick={handleBack}
          >
            « Back to Match Results
          </a>

          <div className="text-center" style={{ flexGrow: 1 }}>
            <div className="text-muted">{eventCode}</div>
            <h1 className="match-results-title">History for {matchName}</h1>
          </div>
        </header>

        <p className="text-center text-muted" style={{ marginBottom: "1rem" }}>
          Most Recent First
        </p>

        {error && (
          <p className="message-block" data-variant="danger" role="alert">
            {error}
          </p>
        )}

        {isLoading ? (
          <LoadingIndicator />
        ) : (
          <div className="table-responsive">
            <table className="match-results-table">
              <thead>
                <tr>
                  <th>Type / Alliance</th>
                  <th>Time</th>
                  <th className="score-col">Red Score</th>
                  <th className="score-col">Blue Score</th>
                  <th className="action-col">Scoresheet</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td className="empty-message text-center" colSpan={5}>
                      No history found for {matchName}.
                    </td>
                  </tr>
                ) : (
                  history.map((entry: MatchHistoryEventItem) => {
                    const redWon =
                      entry.redScore !== null &&
                      entry.blueScore !== null &&
                      entry.redScore > entry.blueScore;
                    const blueWon =
                      entry.redScore !== null &&
                      entry.blueScore !== null &&
                      entry.blueScore > entry.redScore;

                    return (
                      <tr
                        key={`${matchName}-${entry.type}-${entry.ts}-${entry.redScore ?? "na"}-${entry.blueScore ?? "na"}`}
                      >
                        <td>{entry.type}</td>
                        <td>{formatDate(entry.ts)}</td>
                        <td
                          className={`score-cell ${
                            redWon ? "highlight-red" : ""
                          }`}
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
                        <td className="links-cell">
                          <a
                            href={`/event/${eventCode}/match/${matchName}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onNavigate(
                                `/event/${eventCode}/match/${matchName}`
                              );
                            }}
                          >
                            [Scoresheet]
                          </a>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};
