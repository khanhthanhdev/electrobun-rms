import { useEffect, useRef } from "react";
import { useInspectionRealtimeVersion } from "./use-inspection-realtime-version";

const DEBOUNCE_MS = 250;

export const useRealtimeRefresh = (
  eventCode: string,
  token: string | null,
  onRefresh: () => void
): void => {
  const realtimeVersion = useInspectionRealtimeVersion(eventCode);
  const lastAppliedRef = useRef({ eventCode, version: 0 });

  if (lastAppliedRef.current.eventCode !== eventCode) {
    lastAppliedRef.current = { eventCode, version: 0 };
  }

  useEffect(() => {
    if (!token) {
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
  }, [eventCode, realtimeVersion, token, onRefresh]);
};
