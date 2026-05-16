import { createRealtimeVersionStore } from "../../../shared/state/create-realtime-version-store";

export interface DisplayRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: "DISPLAY_SETTINGS_UPDATED" | "SCORE_UPDATE";
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

const realtimeStore =
  createRealtimeVersionStore<DisplayRealtimeChangeEvent>("displayRealtime");

export const getDisplayRealtimeVersion = (eventCode: string): number =>
  realtimeStore.getVersion(eventCode);

export const applyDisplayRealtimeEvent = (
  event: DisplayRealtimeChangeEvent
): void => {
  realtimeStore.applyEvent(event);
};

export const subscribeToDisplayRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => realtimeStore.subscribeToVersion(eventCode, listener);
