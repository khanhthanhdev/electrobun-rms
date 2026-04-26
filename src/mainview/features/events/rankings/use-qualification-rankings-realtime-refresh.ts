import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";
import { useQualificationRankingsRealtimeVersion } from "./use-qualification-rankings-realtime-version";

export const useQualificationRankingsRealtimeRefresh = (
  eventCode: string,
  onRefresh: () => void
): void => {
  const realtimeVersion = useQualificationRankingsRealtimeVersion(eventCode);
  useRealtimeVersionRefresh({
    eventCode,
    onRefresh,
    realtimeVersion,
  });
};
