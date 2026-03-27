import type { DisplaySceneMode } from "@shared/display";
import { InMemorySyncHub } from "../../infrastructure/services/in-memory-sync-hub";

export const DISPLAY_SYNC_EVENT_NAME = "display.command" as const;

export type DisplaySyncChangeKind = "COMMAND_ISSUED" | "SCORE_UPDATE";

export type DisplaySyncEventKind = DisplaySyncChangeKind | "SNAPSHOT_HINT";

export interface DisplaySyncEvent {
  changedAt: string;
  eventCode: string;
  kind: DisplaySyncEventKind;
  matchNumber: number | null;
  matchType: string | null;
  message: string | null;
  mode: DisplaySceneMode | null;
  startedAtMs: number | null;
  version: number;
}

export interface PublishDisplaySyncEventInput {
  eventCode: string;
  kind: DisplaySyncChangeKind;
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
        changedAt: new Date().toISOString(),
        eventCode: input.eventCode,
        kind: input.kind,
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

  subscribe: (eventCode, subscriber) => hub.subscribe(eventCode, subscriber),
};

export const createDisplaySnapshotHintEvent = (
  eventCode: string,
  version: number,
  latest: DisplaySyncEvent | null
): DisplaySyncEvent => ({
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SNAPSHOT_HINT",
  matchNumber: latest?.matchNumber ?? null,
  matchType: latest?.matchType ?? null,
  message: latest?.message ?? null,
  mode: latest?.mode ?? null,
  startedAtMs: latest?.startedAtMs ?? null,
  version,
});

// Display stays in api/ because it is a transport bridge that republishes
// scoring changes without introducing persistence or domain logic.
export const createDisplayScoreUpdateEvent = (
  eventCode: string,
  source: DisplayScoreUpdateSource
): DisplaySyncEvent => ({
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SCORE_UPDATE",
  matchNumber: source.matchNumber,
  matchType: source.matchType,
  message: null,
  mode: null,
  startedAtMs: null,
  version: source.version,
});
