import type { DisplayMatchRef, DisplaySceneMode } from "@shared/display";
import { InMemorySyncHub } from "../../infrastructure/services/in-memory-sync-hub";

export const DISPLAY_SYNC_EVENT_NAME = "display.command" as const;

export type DisplaySyncChangeKind = "COMMAND_ISSUED" | "SCORE_UPDATE";

export type DisplaySyncEventKind = DisplaySyncChangeKind | "SNAPSHOT_HINT";

export interface DisplaySyncEvent {
  activeMatch: DisplayMatchRef | null;
  changedAt: string;
  eventCode: string;
  kind: DisplaySyncEventKind;
  loadedMatch: DisplayMatchRef | null;
  matchNumber: number | null;
  matchType: string | null;
  message: string | null;
  mode: DisplaySceneMode | null;
  startedAtMs: number | null;
  version: number;
}

export interface PublishDisplaySyncEventInput {
  activeMatch?: DisplayMatchRef | null;
  eventCode: string;
  kind: DisplaySyncChangeKind;
  loadedMatch?: DisplayMatchRef | null;
  matchNumber?: number | null;
  matchType?: string | null;
  message?: string | null;
  mode?: DisplaySceneMode | null;
  startedAtMs?: number | null;
}

type DisplaySyncSubscriber = (event: DisplaySyncEvent) => void;

export interface DisplaySyncPublisher {
  getCurrentVersion: (eventCode: string) => number;
  getLatestEvent: (eventCode: string) => DisplaySyncEvent | null;
  publish: (input: PublishDisplaySyncEventInput) => DisplaySyncEvent;
  removeEvent: (eventCode: string) => void;
  subscribe: (
    eventCode: string,
    subscriber: DisplaySyncSubscriber
  ) => () => void;
}

export interface DisplayScoreUpdateSource {
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

const hub = new InMemorySyncHub<DisplaySyncEvent>();
const latestByEventCode = new Map<string, DisplaySyncEvent>();

export const displaySyncHub: DisplaySyncPublisher = {
  getCurrentVersion: (eventCode) => hub.getCurrentVersion(eventCode),

  getLatestEvent: (eventCode) => latestByEventCode.get(eventCode) ?? null,

  publish: (input) =>
    hub.publish(input.eventCode, (version) => {
      const event: DisplaySyncEvent = {
        activeMatch: input.activeMatch ?? null,
        changedAt: new Date().toISOString(),
        eventCode: input.eventCode,
        kind: input.kind,
        loadedMatch: input.loadedMatch ?? null,
        matchNumber: input.matchNumber ?? null,
        matchType: input.matchType ?? null,
        message: input.message ?? null,
        mode: input.mode ?? null,
        startedAtMs: input.startedAtMs ?? null,
        version,
      };
      latestByEventCode.set(input.eventCode, event);
      return event;
    }),

  removeEvent: (eventCode) => {
    hub.removeEvent(eventCode);
    latestByEventCode.delete(eventCode);
  },

  subscribe: (eventCode, subscriber) => hub.subscribe(eventCode, subscriber),
};

export const createDisplaySnapshotHintEvent = (
  eventCode: string,
  version: number,
  latest: DisplaySyncEvent | null
): DisplaySyncEvent => ({
  activeMatch: latest?.activeMatch ?? null,
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SNAPSHOT_HINT",
  loadedMatch: latest?.loadedMatch ?? null,
  matchNumber: latest?.matchNumber ?? null,
  matchType: latest?.matchType ?? null,
  message: latest?.message ?? null,
  mode: latest?.mode ?? null,
  startedAtMs: latest?.startedAtMs ?? null,
  version,
});

// Display stays in api/ because it is a transport bridge that republishes
// scoring changes without introducing persistence or domain logic.
export const publishDisplayScoreUpdate = (
  eventCode: string,
  source: DisplayScoreUpdateSource
): DisplaySyncEvent =>
  displaySyncHub.publish({
    eventCode,
    kind: "SCORE_UPDATE",
    matchNumber: source.matchNumber,
    matchType: source.matchType,
  });
