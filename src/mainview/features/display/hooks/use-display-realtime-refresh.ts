import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";
import { useDisplayRealtimeVersion } from "./use-display-realtime-version";

/**
 * Hook to refresh display data when SCORE_UPDATE events are received.
 * Listens to the display realtime store and triggers a refetch on score updates.
 */
export const useDisplayRealtimeRefresh = (
  eventCode: string,
  onRefresh: () => void
): void => {
  const realtimeVersion = useDisplayRealtimeVersion(eventCode);
  useRealtimeVersionRefresh({
    eventCode,
    onRefresh,
    realtimeVersion,
  });
};
