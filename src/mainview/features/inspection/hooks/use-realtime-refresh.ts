import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";
import { useInspectionRealtimeVersion } from "./use-inspection-realtime-version";

export const useRealtimeRefresh = (
  eventCode: string,
  token: string | null,
  onRefresh: () => void
): void => {
  const realtimeVersion = useInspectionRealtimeVersion(eventCode);
  useRealtimeVersionRefresh({
    enabled: !!token,
    eventCode,
    onRefresh,
    realtimeVersion,
  });
};
