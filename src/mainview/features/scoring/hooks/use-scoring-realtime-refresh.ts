import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";
import { useScoringRealtimeVersion } from "./use-scoring-realtime-version";

export const useScoringRealtimeRefresh = (
  eventCode: string,
  onRefresh: () => void
): void => {
  const realtimeVersion = useScoringRealtimeVersion(eventCode);
  useRealtimeVersionRefresh({
    eventCode,
    onRefresh,
    realtimeVersion,
  });
};
