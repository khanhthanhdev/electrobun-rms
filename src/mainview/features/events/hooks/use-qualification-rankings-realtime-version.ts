import { useSyncExternalStore } from "react";
import {
  getQualificationRankingsRealtimeVersion,
  subscribeToQualificationRankingsRealtimeVersion,
} from "../state/qualification-rankings-sync-store";

export const useQualificationRankingsRealtimeVersion = (
  eventCode: string
): number =>
  useSyncExternalStore(
    (onStoreChange) =>
      subscribeToQualificationRankingsRealtimeVersion(eventCode, onStoreChange),
    () => getQualificationRankingsRealtimeVersion(eventCode),
    () => 0
  );
