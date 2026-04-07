import { useEffect } from "react";
import {
  connectMatchControlRealtime,
  MatchControlRealtimeFatalError,
} from "../services/match-control-sync-service";
import {
  applyMatchControlRealtimeEvent,
  applyMatchControlRealtimeState,
  resetMatchControlRealtimeVersion,
  setMatchControlRealtimeConnectionState,
  setMatchControlRealtimeError,
} from "../state/match-control-sync-store";

export const useMatchControlRealtime = (
  eventCode: string,
  token: string | null
): void => {
  useEffect(() => {
    const abortController = new AbortController();
    setMatchControlRealtimeError(eventCode, "");

    connectMatchControlRealtime({
      eventCode,
      onChangeEvent: (event) => {
        if (event.state) {
          applyMatchControlRealtimeState(
            event.eventCode,
            event.version,
            event.state
          );
        } else {
          applyMatchControlRealtimeEvent(event.eventCode, event.version);
        }
      },
      onConnectionStateChange: (state) => {
        setMatchControlRealtimeConnectionState(eventCode, state);
      },
      onError: (message) => {
        setMatchControlRealtimeError(eventCode, message);
      },
      onReconnected: () => {
        resetMatchControlRealtimeVersion(eventCode);
      },
      signal: abortController.signal,
      token,
    }).catch((error: unknown) => {
      if (abortController.signal.aborted) {
        return;
      }

      if (error instanceof MatchControlRealtimeFatalError) {
        setMatchControlRealtimeConnectionState(eventCode, "stopped");
        setMatchControlRealtimeError(eventCode, error.message);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Match control realtime connection failed.";
      setMatchControlRealtimeConnectionState(eventCode, "error");
      setMatchControlRealtimeError(eventCode, message);
    });

    return () => {
      abortController.abort();
      setMatchControlRealtimeConnectionState(eventCode, "idle");
    };
  }, [eventCode, token]);
};
