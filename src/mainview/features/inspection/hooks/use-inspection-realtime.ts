import { useEffect } from "react";
import {
  connectInspectionRealtime,
  InspectionRealtimeFatalError,
} from "../services/inspection-sync-service";
import {
  applyInspectionRealtimeEvent,
  setInspectionRealtimeConnectionState,
  setInspectionRealtimeError,
} from "../state/inspection-sync-store";

export const useInspectionRealtime = (
  eventCode: string,
  token: string | null
): void => {
  useEffect(() => {
    if (!token) {
      setInspectionRealtimeConnectionState(eventCode, "idle");
      setInspectionRealtimeError(eventCode, "");
      return;
    }

    const abortController = new AbortController();
    setInspectionRealtimeError(eventCode, "");

    connectInspectionRealtime({
      eventCode,
      onChangeEvent: (event) => {
        applyInspectionRealtimeEvent(event);
      },
      onConnectionStateChange: (state) => {
        setInspectionRealtimeConnectionState(eventCode, state);
      },
      onError: (message) => {
        setInspectionRealtimeError(eventCode, message);
      },
      signal: abortController.signal,
      token,
    }).catch((error: unknown) => {
      if (abortController.signal.aborted) {
        return;
      }

      if (error instanceof InspectionRealtimeFatalError) {
        setInspectionRealtimeConnectionState(eventCode, "stopped");
        setInspectionRealtimeError(eventCode, error.message);
        return;
      }

      const message =
        error instanceof Error
          ? error.message
          : "Inspection realtime connection failed.";
      setInspectionRealtimeConnectionState(eventCode, "error");
      setInspectionRealtimeError(eventCode, message);
    });

    return () => {
      abortController.abort();
      setInspectionRealtimeConnectionState(eventCode, "idle");
    };
  }, [eventCode, token]);
};
