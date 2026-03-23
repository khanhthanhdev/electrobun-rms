import { useSyncExternalStore } from "react";
import {
  getDisplayRealtimeVersion,
  subscribeToDisplayRealtimeVersion,
} from "../state/display-realtime-store";

export const useDisplayRealtimeVersion = (eventCode: string): number =>
  useSyncExternalStore(
    (onStoreChange) =>
      subscribeToDisplayRealtimeVersion(eventCode, onStoreChange),
    () => getDisplayRealtimeVersion(eventCode),
    () => 0
  );
