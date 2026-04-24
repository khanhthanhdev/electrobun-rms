import type { InspectionRealtimeChangeEvent } from "../../../shared/types/inspection";
import {
  createRealtimeVersionStore,
  type GenericRealtimeConnectionState,
} from "../../../shared/state/create-realtime-version-store";

const realtimeStore = createRealtimeVersionStore<InspectionRealtimeChangeEvent>(
  "inspectionRealtime"
);

export type InspectionRealtimeConnectionState = GenericRealtimeConnectionState;

export const getInspectionRealtimeVersion = (eventCode: string): number =>
  realtimeStore.getVersion(eventCode);

export const setInspectionRealtimeConnectionState = (
  eventCode: string,
  state: InspectionRealtimeConnectionState
): void => {
  realtimeStore.setConnectionState(eventCode, state);
};

export const setInspectionRealtimeError = (
  eventCode: string,
  message: string
): void => {
  realtimeStore.setError(eventCode, message);
};

export const applyInspectionRealtimeEvent = (
  event: InspectionRealtimeChangeEvent
): void => {
  realtimeStore.applyEvent(event);
};

export const resetInspectionRealtimeVersion = (eventCode: string): void => {
  realtimeStore.resetVersion(eventCode);
};

export const subscribeToInspectionRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => realtimeStore.subscribeToVersion(eventCode, listener);
