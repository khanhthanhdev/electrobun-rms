import type { MatchControlState } from "@shared/match-control";
import { InMemorySyncHub } from "../../infrastructure/services/in-memory-sync-hub";

export const MATCH_CONTROL_SYNC_EVENT_NAME = "match-control.state" as const;

export type MatchControlSyncEventKind = "STATE_CHANGED" | "SNAPSHOT_HINT";

export interface MatchControlSyncEvent {
  eventCode: string;
  kind: MatchControlSyncEventKind;
  state: MatchControlState;
  version: number;
}

type MatchControlSyncSubscriber = (event: MatchControlSyncEvent) => void;

export interface MatchControlSyncPublisher {
  getCurrentVersion: (eventCode: string) => number;
  getLatestEvent: (eventCode: string) => MatchControlSyncEvent | null;
  publish: (state: MatchControlState) => MatchControlSyncEvent;
  removeEvent: (eventCode: string) => void;
  subscribe: (
    eventCode: string,
    subscriber: MatchControlSyncSubscriber
  ) => () => void;
}

const hub = new InMemorySyncHub<MatchControlSyncEvent>();
const latestByEventCode = new Map<string, MatchControlSyncEvent>();

export const matchControlSyncHub: MatchControlSyncPublisher = {
  getCurrentVersion: (eventCode) => hub.getCurrentVersion(eventCode),

  getLatestEvent: (eventCode) => latestByEventCode.get(eventCode) ?? null,

  publish: (state) =>
    hub.publish(state.eventCode, (version) => {
      const event: MatchControlSyncEvent = {
        eventCode: state.eventCode,
        kind: "STATE_CHANGED",
        state: { ...state, version },
        version,
      };
      latestByEventCode.set(state.eventCode, event);
      return event;
    }),

  removeEvent: (eventCode) => {
    hub.removeEvent(eventCode);
    latestByEventCode.delete(eventCode);
  },

  subscribe: (eventCode, subscriber) => hub.subscribe(eventCode, subscriber),
};

export const createMatchControlSnapshotHintEvent = (
  eventCode: string,
  version: number,
  latest: MatchControlSyncEvent | null
): MatchControlSyncEvent => ({
  eventCode,
  kind: "SNAPSHOT_HINT",
  state: latest?.state ?? {
    eventCode,
    version,
    loadedMatch: null,
    loadedState: "IDLE",
    activeMatch: null,
    activeState: "IDLE",
    activeStartedAtMs: null,
  },
  version,
});
