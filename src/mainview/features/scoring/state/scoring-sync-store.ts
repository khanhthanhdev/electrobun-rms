import {
  createRealtimeVersionStore,
  type GenericRealtimeConnectionState,
} from "../../../shared/state/create-realtime-version-store";
import type { ScoringRealtimeChangeEvent } from "../../../shared/types/scoring";

const realtimeStore =
  createRealtimeVersionStore<ScoringRealtimeChangeEvent>("scoringRealtime");

export type ScoringRealtimeConnectionState = GenericRealtimeConnectionState;

export const getScoringRealtimeVersion = (eventCode: string): number =>
  realtimeStore.getVersion(eventCode);

export const setScoringRealtimeConnectionState = (
  eventCode: string,
  state: ScoringRealtimeConnectionState
): void => {
  realtimeStore.setConnectionState(eventCode, state);
};

export const setScoringRealtimeError = (
  eventCode: string,
  message: string
): void => {
  realtimeStore.setError(eventCode, message);
};

export const applyScoringRealtimeEvent = (
  event: ScoringRealtimeChangeEvent
): void => {
  realtimeStore.applyEvent(event);
};

export const resetScoringRealtimeVersion = (eventCode: string): void => {
  realtimeStore.resetVersion(eventCode);
};

export const subscribeToScoringRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => realtimeStore.subscribeToVersion(eventCode, listener);
