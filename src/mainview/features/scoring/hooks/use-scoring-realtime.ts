import { useEffect } from "react";
import {
  connectScoringRealtime,
  ScoringRealtimeFatalError,
} from "../services/scoring-sync-service";
import {
  applyScoringRealtimeEvent,
  setScoringRealtimeConnectionState,
  setScoringRealtimeError,
} from "../state/scoring-sync-store";

export const useScoringRealtime = (
  eventCode: string,
  token: string | null
): void => {
  useEffect(() => {
    const abortController = new AbortController();
    setScoringRealtimeError(eventCode, "");

    connectScoringRealtime({
      eventCode,
      onChangeEvent: (event) => {
        applyScoringRealtimeEvent(event);
      },
      onConnectionStateChange: (state) => {
        setScoringRealtimeConnectionState(eventCode, state);
      },
      onError: (message) => {
        setScoringRealtimeError(eventCode, message);
      },
      signal: abortController.signal,
      token,
    }).catch((error: unknown) => {
      if (abortController.signal.aborted) {
        return;
      }

      if (error instanceof ScoringRealtimeFatalError) {
        setScoringRealtimeConnectionState(eventCode, "stopped");
        setScoringRealtimeError(eventCode, error.message);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Scoring realtime connection failed.";
      setScoringRealtimeConnectionState(eventCode, "error");
      setScoringRealtimeError(eventCode, message);
    });

    return () => {
      abortController.abort();
      setScoringRealtimeConnectionState(eventCode, "idle");
    };
  }, [eventCode, token]);
};
