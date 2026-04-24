import { useScoringRealtimeVersion } from "./use-scoring-realtime-version";
import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";

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
