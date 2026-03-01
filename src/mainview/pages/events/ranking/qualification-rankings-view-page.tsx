import { useCallback, useEffect, useReducer, useState } from "react";
import {
  fetchQualificationRankings,
  type QualificationRankingItem,
  useQualificationRankingsRealtime,
  useQualificationRankingsRealtimeRefresh,
} from "@/features/events/rankings";
import { LoadingIndicator } from "../../../shared/components/loading-indicator";
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

interface QualificationRankingsState {
  errorMessage: string | null;
  isLoading: boolean;
  rows: RankingTableRow[];
}

type QualificationRankingsAction =
  | { type: "start" }
  | { type: "success"; rows: RankingTableRow[] }
  | { type: "error"; errorMessage: string };

const qualificationRankingsReducer = (
  _state: QualificationRankingsState,
  action: QualificationRankingsAction
): QualificationRankingsState => {
  switch (action.type) {
    case "start":
      return { isLoading: true, errorMessage: null, rows: [] };
    case "success":
      return { isLoading: false, errorMessage: null, rows: action.rows };
    case "error":
      return { isLoading: false, errorMessage: action.errorMessage, rows: [] };
    default:
      return _state;
  }
};

export const QualificationRankingsViewPage = ({
  eventCode,
  token,
}: QualificationRankingsViewPageProps): JSX.Element => {
  const [refreshTick, setRefreshTick] = useState(0);
  const [state, dispatch] = useReducer(qualificationRankingsReducer, {
    isLoading: true,
    errorMessage: null,
    rows: [],
  });

  const refreshRankings = useCallback((): void => {
    setRefreshTick((tick) => tick + 1);
  }, []);

  useQualificationRankingsRealtime(eventCode, token);
  useQualificationRankingsRealtimeRefresh(eventCode, refreshRankings);

  useEffect(() => {
    let isCancelled = false;

    dispatch({ type: "start" });

    fetchQualificationRankings(eventCode, token, refreshTick)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        dispatch({
          type: "success",
          rows: mapRankingItemsToRows(response.rankings),
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }

        dispatch({
          type: "error",
          errorMessage:
            error instanceof Error ? error.message : "Failed to load rankings.",
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [eventCode, token, refreshTick]);

  if (state.isLoading) {
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

      {state.errorMessage ? (
        <p className="message-block" data-variant="danger" role="alert">
          {state.errorMessage}
        </p>
      ) : null}

      <div className="schedule-public-view__table-wrap">
        <RankingTable
          emptyMessage="No qualification rankings available."
          rows={state.rows}
        />
      </div>
    </main>
  );
};
