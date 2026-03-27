import { InMemorySyncHub } from "../../infrastructure/services/in-memory-sync-hub";

export const SCORING_SYNC_EVENT_NAME = "scoring.change" as const;

export type ScoringSyncChangeKind = "SCORE_UPDATED";

export type ScoringSyncEventKind = ScoringSyncChangeKind | "SNAPSHOT_HINT";

export interface ScoringSyncEvent {
  changedAt: string;
  eventCode: string;
  kind: ScoringSyncEventKind;
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

export interface PublishScoringSyncEventInput {
  eventCode: string;
  kind: ScoringSyncChangeKind;
  matchNumber?: number | null;
  matchType?: string | null;
}

type ScoringSyncSubscriber = (event: ScoringSyncEvent) => void;

export interface ScoringSyncPublisher {
  getCurrentVersion: (eventCode: string) => number;
  publish: (input: PublishScoringSyncEventInput) => ScoringSyncEvent;
  subscribe: (
    eventCode: string,
    subscriber: ScoringSyncSubscriber
  ) => () => void;
}

const hub = new InMemorySyncHub<ScoringSyncEvent>();

export const scoringSyncHub: ScoringSyncPublisher = {
  getCurrentVersion: (eventCode) => hub.getCurrentVersion(eventCode),

  publish: (input) =>
    hub.publish(input.eventCode, (version) => ({
      changedAt: new Date().toISOString(),
      eventCode: input.eventCode,
      kind: input.kind,
      matchNumber: input.matchNumber ?? null,
      matchType: input.matchType ?? null,
      version,
    })),

  subscribe: (eventCode, subscriber) => hub.subscribe(eventCode, subscriber),
};

export const createScoringSnapshotHintEvent = (
  eventCode: string,
  version: number
): ScoringSyncEvent => ({
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SNAPSHOT_HINT",
  matchNumber: null,
  matchType: null,
  version,
});
