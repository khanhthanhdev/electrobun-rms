import { useCallback, useEffect, useState } from "react";
import { useQualificationRankingsRealtime } from "../../../features/events/hooks/use-qualification-rankings-realtime";
import { useQualificationRankingsRealtimeRefresh } from "../../../features/events/hooks/use-qualification-rankings-realtime-refresh";
import {
  fetchQualificationRankings,
  type QualificationRankingItem,
} from "../../../features/events/services/qualification-rankings-service";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import "../../../app/styles/components/schedule.css";
import { RankingTable, type RankingTableRow } from "./components/ranking-table";

interface QualificationRankingsViewPageProps {
  eventCode: string;
  token: string | null;
}

const mapRankingItemsToRows = (
  rankings: QualificationRankingItem[]
): RankingTableRow[] =>
  rankings.map((rankingItem) => ({
    rank: rankingItem.rank,
    teamNumber: rankingItem.teamNumber,
    name: rankingItem.name,
    rankingPoint: rankingItem.rankingPoint,
    total: rankingItem.total,
    wins: rankingItem.wins,
    losses: rankingItem.losses,
    ties: rankingItem.ties,
    played: rankingItem.played,
  }));

export const QualificationRankingsViewPage = ({
  eventCode,
  token,
}: QualificationRankingsViewPageProps): JSX.Element => {
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<RankingTableRow[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshRankings = useCallback((): void => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useQualificationRankingsRealtime(eventCode, token);
  useQualificationRankingsRealtimeRefresh(eventCode, refreshRankings);

  useEffect(() => {
    let isCancelled = false;

    setIsLoading(true);
    setErrorMessage(null);

    fetchQualificationRankings(eventCode, token, refreshTick)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        setRows(mapRankingItemsToRows(response.rankings));
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load rankings."
        );
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token, refreshTick]);

  if (isLoading) {
    return (
      <main className="page-shell page-shell--center schedule-page">
        <LoadingIndicator />
      </main>
    );
  }

  return (
    <main className="schedule-page-shell schedule-public-view">
      <div className="schedule-view-top-nav">
        <a
          className="back-link schedule-page-back-link"
          href={`/event/${eventCode}`}
        >
          &lt;&lt; Back <span className="hide-mobile">to Event Home</span>
        </a>
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
          {eventCode.toUpperCase()} Rankings
        </h2>
      </header>

      {errorMessage ? (
        <p className="message-block" data-variant="danger" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="schedule-public-view__table-wrap">
        <RankingTable
          emptyMessage="No qualification rankings available."
          rows={rows}
        />
      </div>
    </main>
  );
};
