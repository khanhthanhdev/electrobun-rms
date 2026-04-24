import type { QualificationRankingRealtimeChangeEvent } from "@/shared/types/ranking";
import {
  createRealtimeVersionStore,
  type GenericRealtimeConnectionState,
} from "@/shared/state/create-realtime-version-store";

const realtimeStore =
  createRealtimeVersionStore<QualificationRankingRealtimeChangeEvent>(
    "qualificationRankingsRealtime"
  );

export type QualificationRankingsRealtimeConnectionState =
  GenericRealtimeConnectionState;

export const getQualificationRankingsRealtimeVersion = (
  eventCode: string
): number => realtimeStore.getVersion(eventCode);

export const setQualificationRankingsRealtimeConnectionState = (
  eventCode: string,
  state: QualificationRankingsRealtimeConnectionState
): void => {
  realtimeStore.setConnectionState(eventCode, state);
};

export const setQualificationRankingsRealtimeError = (
  eventCode: string,
  message: string
): void => {
  realtimeStore.setError(eventCode, message);
};

export const applyQualificationRankingsRealtimeEvent = (
  event: QualificationRankingRealtimeChangeEvent
): void => {
  realtimeStore.applyEvent(event);
};

export const resetQualificationRankingsRealtimeVersion = (
  eventCode: string
): void => {
  realtimeStore.resetVersion(eventCode);
};

export const subscribeToQualificationRankingsRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => realtimeStore.subscribeToVersion(eventCode, listener);
