import { useEffect, useRef } from "react";
import { useQualificationRankingsRealtimeVersion } from "./use-qualification-rankings-realtime-version";

const DEBOUNCE_MS = 250;

export const useQualificationRankingsRealtimeRefresh = (
  eventCode: string,
  onRefresh: () => void
): void => {
  const realtimeVersion = useQualificationRankingsRealtimeVersion(eventCode);
  const lastAppliedRef = useRef({ eventCode, version: 0 });

  if (lastAppliedRef.current.eventCode !== eventCode) {
    lastAppliedRef.current = { eventCode, version: 0 };
  }

  useEffect(() => {
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
