import {
  createRealtimeVersionStore,
  type GenericRealtimeConnectionState,
} from "../../../shared/state/create-realtime-version-store";

export interface DisplayRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: "SCORE_UPDATE";
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

const realtimeStore =
  createRealtimeVersionStore<DisplayRealtimeChangeEvent>("displayRealtime");

export type DisplayRealtimeConnectionState = GenericRealtimeConnectionState;

export const getDisplayRealtimeVersion = (eventCode: string): number =>
  realtimeStore.getVersion(eventCode);

export const setDisplayRealtimeConnectionState = (
  eventCode: string,
  state: DisplayRealtimeConnectionState
): void => {
  realtimeStore.setConnectionState(eventCode, state);
};

export const setDisplayRealtimeError = (
  eventCode: string,
  message: string
): void => {
  realtimeStore.setError(eventCode, message);
};

export const applyDisplayRealtimeEvent = (
  event: DisplayRealtimeChangeEvent
): void => {
  realtimeStore.applyEvent(event);
};

export const resetDisplayRealtimeVersion = (eventCode: string): void => {
  realtimeStore.resetVersion(eventCode);
};

export const subscribeToDisplayRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => realtimeStore.subscribeToVersion(eventCode, listener);
