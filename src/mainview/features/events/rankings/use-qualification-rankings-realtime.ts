import { useEffect } from "react";
import {
  connectQualificationRankingsRealtime,
  QualificationRankingsRealtimeFatalError,
} from "./qualification-rankings-sync-service";
import {
  applyQualificationRankingsRealtimeEvent,
  setQualificationRankingsRealtimeConnectionState,
  setQualificationRankingsRealtimeError,
} from "./qualification-rankings-sync-store";

export const useQualificationRankingsRealtime = (
  eventCode: string,
  token: string | null
): void => {
  useEffect(() => {
    const abortController = new AbortController();
    setQualificationRankingsRealtimeError(eventCode, "");

    connectQualificationRankingsRealtime({
      eventCode,
      onChangeEvent: (event) => {
        applyQualificationRankingsRealtimeEvent(event);
      },
      onConnectionStateChange: (state) => {
        setQualificationRankingsRealtimeConnectionState(eventCode, state);
      },
      onError: (message) => {
        setQualificationRankingsRealtimeError(eventCode, message);
      },
      signal: abortController.signal,
      token,
    }).catch((error: unknown) => {
      if (abortController.signal.aborted) {
        return;
      }

      if (error instanceof QualificationRankingsRealtimeFatalError) {
        setQualificationRankingsRealtimeConnectionState(eventCode, "stopped");
        setQualificationRankingsRealtimeError(eventCode, error.message);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Qualification rankings realtime connection failed.";
      setQualificationRankingsRealtimeConnectionState(eventCode, "error");
      setQualificationRankingsRealtimeError(eventCode, message);
    });

    return () => {
      abortController.abort();
      setQualificationRankingsRealtimeConnectionState(eventCode, "idle");
    };
  }, [eventCode, token]);
};
