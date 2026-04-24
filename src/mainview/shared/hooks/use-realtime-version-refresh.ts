import { useEffect, useRef } from "react";

const DEBOUNCE_MS = 250;

interface UseRealtimeVersionRefreshOptions {
  enabled?: boolean;
  eventCode: string;
  onRefresh: () => void;
  realtimeVersion: number;
}

export const useRealtimeVersionRefresh = ({
  enabled = true,
  eventCode,
  onRefresh,
  realtimeVersion,
}: UseRealtimeVersionRefreshOptions): void => {
  const lastAppliedRef = useRef({ eventCode, version: 0 });

  if (lastAppliedRef.current.eventCode !== eventCode) {
    lastAppliedRef.current = { eventCode, version: 0 };
  }

  useEffect(() => {
    if (!enabled) {
      return;
    }

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
  }, [enabled, eventCode, realtimeVersion, onRefresh]);
};
