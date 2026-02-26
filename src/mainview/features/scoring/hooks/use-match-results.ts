import { useCallback, useEffect, useRef, useState } from "react";
import type {
  MatchHistoryEventItem,
  MatchResultItem,
  MatchScoresheet,
  MatchType,
} from "../../../shared/types/scoring";
import {
  fetchMatchHistory,
  fetchMatchResults,
  fetchMatchScoresheet,
} from "../services/scoring-api";
import { subscribeToScoringRealtimeVersion } from "../state/scoring-sync-store";

export const useMatchResults = (
  eventCode: string,
  matchType: MatchType,
  token: string | null
) => {
  const [results, setResults] = useState<MatchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRequestId = useRef(0);

  const loadResults = useCallback(async () => {
    const requestId = ++currentRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMatchResults(eventCode, matchType, token);
      if (requestId === currentRequestId.current) {
        setResults(data);
      }
    } catch (err) {
      if (requestId === currentRequestId.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load match results"
        );
      }
      return;
    } finally {
      if (requestId === currentRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [eventCode, matchType, token]);

  useEffect(() => {
    loadResults();

    return subscribeToScoringRealtimeVersion(eventCode, () => {
      // Refetch results when score updates
      loadResults();
    });
  }, [loadResults, eventCode]);

  return { results, isLoading, error, refresh: loadResults };
};

export const useMatchHistory = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number,
  token: string | null,
  enabled = true
) => {
  const [history, setHistory] = useState<MatchHistoryEventItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRequestId = useRef(0);

  const loadHistory = useCallback(async () => {
    if (!enabled) {
      setHistory([]);
      setError(null);
      setIsLoading(false);
      return;
    }
    const requestId = ++currentRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMatchHistory(
        eventCode,
        matchType,
        matchNumber,
        token
      );
      if (requestId === currentRequestId.current) {
        setHistory(data);
      }
    } catch (err) {
      if (requestId === currentRequestId.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load match history"
        );
      }
      return;
    } finally {
      if (requestId === currentRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, eventCode, matchType, matchNumber, token]);

  useEffect(() => {
    loadHistory();

    if (!enabled) {
      return;
    }

    return subscribeToScoringRealtimeVersion(eventCode, () => {
      loadHistory();
    });
  }, [enabled, loadHistory, eventCode]);

  return { history, isLoading, error, refresh: loadHistory };
};

export const useMatchScoresheet = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number,
  token: string | null,
  enabled = true
) => {
  const [scoresheet, setScoresheet] = useState<MatchScoresheet | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentRequestId = useRef(0);

  const loadScoresheet = useCallback(async () => {
    if (!enabled) {
      setScoresheet(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    const requestId = ++currentRequestId.current;

    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMatchScoresheet(
        eventCode,
        matchType,
        matchNumber,
        token
      );
      if (requestId === currentRequestId.current) {
        setScoresheet(data);
      }
    } catch (err) {
      if (requestId === currentRequestId.current) {
        setError(
          err instanceof Error ? err.message : "Failed to load match scoresheet"
        );
      }
      return;
    } finally {
      if (requestId === currentRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [enabled, eventCode, matchType, matchNumber, token]);

  useEffect(() => {
    loadScoresheet();

    if (!enabled) {
      return;
    }

    return subscribeToScoringRealtimeVersion(eventCode, () => {
      loadScoresheet();
    });
  }, [enabled, loadScoresheet, eventCode]);

  return { scoresheet, isLoading, error, refresh: loadScoresheet };
};
