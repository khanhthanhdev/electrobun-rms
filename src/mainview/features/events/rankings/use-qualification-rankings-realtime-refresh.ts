import { useQualificationRankingsRealtimeVersion } from "./use-qualification-rankings-realtime-version";
import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";

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
