import { useSyncExternalStore } from "react";
import {
  getInspectionRealtimeVersion,
  subscribeToInspectionRealtimeVersion,
} from "../state/inspection-sync-store";

export const useInspectionRealtimeVersion = (eventCode: string): number =>
  useSyncExternalStore(
    (onStoreChange) =>
      subscribeToInspectionRealtimeVersion(eventCode, onStoreChange),
    () => getInspectionRealtimeVersion(eventCode),
    () => 0
  );
