import { useSyncExternalStore } from "react";
import {
  getScoringRealtimeVersion,
  subscribeToScoringRealtimeVersion,
} from "../state/scoring-sync-store";

export const useScoringRealtimeVersion = (eventCode: string): number =>
  useSyncExternalStore(
    (onStoreChange) =>
      subscribeToScoringRealtimeVersion(eventCode, onStoreChange),
    () => getScoringRealtimeVersion(eventCode),
    () => 0
  );
