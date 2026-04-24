import { useInspectionRealtimeVersion } from "./use-inspection-realtime-version";
import { useRealtimeVersionRefresh } from "../../../shared/hooks/use-realtime-version-refresh";

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
