import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMatchResults } from "../../../features/scoring/hooks/use-match-results";
import { fetchMatchResults } from "../../../features/scoring/services/scoring-api";
import { subscribeToScoringRealtimeVersion } from "../../../features/scoring/state/scoring-sync-store";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type { MatchResultItem, MatchType } from "../../../shared/types/scoring";

interface MatchResultsPageProps {
  eventCode: string;
  onNavigate: (path: string) => void;
  token: string | null;
}

const TAB_ORDER: MatchType[] = ["practice", "quals", "elims"];
const TAB_LABELS: Record<MatchType, string> = {
  practice: "Practice",
  quals: "Qualification",
  elims: "Elimination",
};
const MATCH_PREFIXES: Record<MatchType, string> = {
  practice: "P",
  quals: "Q",
  elims: "E",
};
const DEFAULT_TABS: MatchType[] = ["practice", "quals"];

const formatTeamLabel = ({
  isSurrogate,
  teamName,
  teamNumber,
}: {
  isSurrogate: boolean;
  teamName: string;
  teamNumber: number;
}): string => {
  const teamTag = `#${teamNumber}${isSurrogate ? "*" : ""}`;
  const normalizedTeamName = teamName.trim();

  return normalizedTeamName ? `${teamTag} ${normalizedTeamName}` : teamTag;
};

const MatchRow = ({
  match,
  matchType,
  eventCode,
  onNavigate,
}: {
  match: MatchResultItem;
  matchType: MatchType;
  eventCode: string;
  onNavigate: (path: string) => void;
}) => {
  const matchName = `${MATCH_PREFIXES[matchType]}${match.matchNumber}`;
  const redWon =
    match.redScore !== null &&
    match.blueScore !== null &&
    match.redScore > match.blueScore;
  const blueWon =
    match.redScore !== null &&
    match.blueScore !== null &&
    match.blueScore > match.redScore;

  const navigateTo = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <tr>
      <td className="match-name">{matchName}</td>
      <td className={`team-cell red-alliance ${redWon ? "winner" : ""}`}>
        {formatTeamLabel({
          teamNumber: match.redTeam,
          teamName: match.redTeamName,
          isSurrogate: match.redSurrogate,
        })}
      </td>
      <td className={`score-cell ${redWon ? "highlight-red" : ""}`}>
        {match.redScore ?? "-"}
      </td>
      <td className={`score-cell ${blueWon ? "highlight-blue" : ""}`}>
        {match.blueScore ?? "-"}
      </td>
      <td className={`team-cell blue-alliance ${blueWon ? "winner" : ""}`}>
        {formatTeamLabel({
          teamNumber: match.blueTeam,
          teamName: match.blueTeamName,
          isSurrogate: match.blueSurrogate,
        })}
      </td>
      <td className="links-cell">
        <a
          href={`/event/${eventCode}/match/${matchName}`}
          onClick={navigateTo(`/event/${eventCode}/match/${matchName}`)}
        >
          [Scoresheet]
        </a>
        <div className="sub-links">
          <a
            className="red-link"
            href={`/event/${eventCode}/match/${matchName}/red`}
            onClick={navigateTo(`/event/${eventCode}/match/${matchName}/red`)}
          >
            [Red]
          </a>
          <a
            className="blue-link"
            href={`/event/${eventCode}/match/${matchName}/blue`}
            onClick={navigateTo(`/event/${eventCode}/match/${matchName}/blue`)}
          >
            [Blue]
          </a>
        </div>
      </td>
      <td className="links-cell">
        <a
          href={`/event/${eventCode}/match/${matchName}/history`}
          onClick={navigateTo(`/event/${eventCode}/match/${matchName}/history`)}
        >
          [Match History]
        </a>
      </td>
    </tr>
  );
};

export const MatchResultsPage = ({
  eventCode,
  onNavigate,
  token,
}: MatchResultsPageProps): JSX.Element => {
  const [matchType, setMatchType] = useState<MatchType>("practice");
  const [isCondensed, setIsCondensed] = useState(false);
  const [keepBackground, setKeepBackground] = useState(false);
  const { tabs } = useAvailableResultTabs(eventCode, token);

  useEffect(() => {
    if (!tabs.includes(matchType)) {
      setMatchType(tabs[0] ?? "practice");
    }
  }, [tabs, matchType]);

  const { results, isLoading, error } = useMatchResults(
    eventCode,
    matchType,
    token
  );

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    onNavigate(`/event/${eventCode}`);
  };

  const currentYear = new Date().getFullYear();

  return (
    <main className="schedule-page-shell schedule-public-view">
      <div className="schedule-view-top-nav" style={{ padding: "0 0.5rem" }}>
        <a
          className="back-link schedule-page-back-link"
          href={`/event/${eventCode}`}
          onClick={handleBack}
        >
          &lt;&lt; Back <span className="hide-mobile">to Event Home</span>
        </a>

        <div
          className="match-results-controls show-desktop-flex"
          style={{ marginLeft: "auto", marginRight: "1rem" }}
        >
          <label className="checkbox-control">
            <input
              checked={isCondensed}
              onChange={(e) => setIsCondensed(e.target.checked)}
              type="checkbox"
            />
            <span className="checkbox-label">Condensed</span>
          </label>

          <label className="checkbox-control">
            <input
              checked={keepBackground}
              onChange={(e) => setKeepBackground(e.target.checked)}
              type="checkbox"
            />
            <span className="checkbox-label">Keep Background</span>
          </label>
        </div>

        <button
          className="schedule-public-view__print-text-button"
          onClick={() => window.print()}
          type="button"
        >
          Print
        </button>
      </div>

      <header className="schedule-public-view__header">
        <h2 className="app-heading schedule-page-title schedule-public-view__title">
          NRC {currentYear} Match Results
        </h2>
      </header>

      <div className="tab-navigation" style={{ padding: "0 0.5rem" }}>
        {tabs.map((tab) => (
          <button
            className={`tab-button ${matchType === tab ? "active" : ""}`}
            key={tab}
            onClick={() => setMatchType(tab)}
            type="button"
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="schedule-public-view__table-wrap">
        <StandardMatchesView
          error={error}
          eventCode={eventCode}
          isCondensed={isCondensed}
          isLoading={isLoading}
          keepBackground={keepBackground}
          matchType={matchType}
          onNavigate={onNavigate}
          results={results}
        />
      </div>
    </main>
  );
};

interface StandardMatchesViewProps {
  error: string | null;
  eventCode: string;
  isCondensed: boolean;
  isLoading: boolean;
  keepBackground: boolean;
  matchType: MatchType;
  onNavigate: (path: string) => void;
  results: MatchResultItem[];
}

const StandardMatchesView = ({
  error,
  eventCode,
  isCondensed,
  isLoading,
  keepBackground,
  matchType,
  onNavigate,
  results,
}: StandardMatchesViewProps): JSX.Element => (
  <>
    {error && (
      <p className="message-block" data-variant="danger" role="alert">
        {error}
      </p>
    )}
    {isLoading ? (
      <LoadingIndicator />
    ) : (
      <div className="table-responsive">
        <table
          className={`match-results-table ${
            isCondensed ? "condensed" : ""
          } ${keepBackground ? "keep-background" : ""}`}
        >
          <thead>
            <tr>
              <th>Match</th>
              <th>Red</th>
              <th className="score-col">Red Score</th>
              <th className="score-col">Blue Score</th>
              <th>Blue</th>
              <th className="action-col">Breakdown</th>
              <th className="action-col">History</th>
            </tr>
          </thead>
          <tbody>
            {results.length === 0 ? (
              <tr>
                <td className="empty-message text-center" colSpan={7}>
                  No matches found for {TAB_LABELS[matchType].toLowerCase()}.
                </td>
              </tr>
            ) : (
              results.map((match) => (
                <MatchRow
                  eventCode={eventCode}
                  key={match.matchNumber}
                  match={match}
                  matchType={matchType}
                  onNavigate={onNavigate}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    )}
  </>
);

const useAvailableResultTabs = (
  eventCode: string,
  token: string | null
): {
  tabs: MatchType[];
} => {
  const [tabs, setTabs] = useState<MatchType[]>(DEFAULT_TABS);
  const currentRequestId = useRef(0);

  const loadTabs = useCallback(async () => {
    const requestId = ++currentRequestId.current;

    const availability = await Promise.all(
      TAB_ORDER.map(async (matchType) => {
        try {
          const rows = await fetchMatchResults(eventCode, matchType, token);
          return { matchType, hasRows: rows.length > 0 };
        } catch {
          return { matchType, hasRows: false };
        }
      })
    );

    if (requestId !== currentRequestId.current) {
      return;
    }

    const visibleTabs = availability
      .filter((entry) => entry.hasRows)
      .map((entry) => entry.matchType);
    setTabs(visibleTabs.length > 0 ? visibleTabs : DEFAULT_TABS);
  }, [eventCode, token]);

  useEffect(() => {
    loadTabs();

    return subscribeToScoringRealtimeVersion(eventCode, () => {
      loadTabs();
    });
  }, [eventCode, loadTabs]);

  return { tabs };
};
