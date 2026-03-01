import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeToScoringRealtimeVersion } from "@/features/scoring/state/scoring-sync-store";
import type { MatchControlData } from "@/shared/types/match-control";
import { fetchMatchControlData } from "./match-control-service";

interface UseMatchControlDataResult {
  data: MatchControlData | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export const useMatchControlData = (
  eventCode: string,
  token: string | null
): UseMatchControlDataResult => {
  const [data, setData] = useState<MatchControlData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentRequestId = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++currentRequestId.current;

    if (!token) {
      setData(null);
      setIsLoading(false);
      setError("Authentication required.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchMatchControlData(eventCode, token);
      if (requestId !== currentRequestId.current) {
        return;
      }

      setData(response);
    } catch (loadError) {
      if (requestId !== currentRequestId.current) {
        return;
      }

      setData(null);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load match control data."
      );
    } finally {
      if (requestId === currentRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [eventCode, token]);

  useEffect(() => {
    loadData();

    if (!token) {
      return;
    }

    return subscribeToScoringRealtimeVersion(eventCode, () => {
      loadData();
    });
  }, [eventCode, loadData, token]);

  return { data, error, isLoading, refresh: loadData };
};
