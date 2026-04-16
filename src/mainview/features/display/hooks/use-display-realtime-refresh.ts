import { useEffect, useRef } from "react";
import { useDisplayRealtimeVersion } from "./use-display-realtime-version";

const DEBOUNCE_MS = 250;

/**
 * Hook to refresh display data when SCORE_UPDATE events are received.
 * Listens to the display realtime store and triggers a refetch on score updates.
 */
export const useDisplayRealtimeRefresh = (
  eventCode: string,
  onRefresh: () => void
): void => {
  const realtimeVersion = useDisplayRealtimeVersion(eventCode);
  const lastAppliedRef = useRef({ eventCode, version: 0 });

  if (lastAppliedRef.current.eventCode !== eventCode) {
    lastAppliedRef.current = { eventCode, version: 0 };
  }

  useEffect(() => {
    if (realtimeVersion < lastAppliedRef.current.version) {
      lastAppliedRef.current = { eventCode, version: 0 };
      return;
    }

    if (realtimeVersion <= lastAppliedRef.current.version) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      lastAppliedRef.current = { eventCode, version: realtimeVersion };
      onRefresh();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [eventCode, realtimeVersion, onRefresh]);
};
