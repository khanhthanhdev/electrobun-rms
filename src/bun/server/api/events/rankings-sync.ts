import { InMemorySyncHub } from "../../infrastructure/services/in-memory-sync-hub";

export const QUALIFICATION_RANKINGS_SYNC_EVENT_NAME =
  "qualification-rankings.change" as const;

export type QualificationRankingsSyncChangeKind = "RANKINGS_UPDATED";

export type QualificationRankingsSyncEventKind =
  | QualificationRankingsSyncChangeKind
  | "SNAPSHOT_HINT";

export interface QualificationRankingsSyncEvent {
  changedAt: string;
  eventCode: string;
  kind: QualificationRankingsSyncEventKind;
  version: number;
}

export interface PublishQualificationRankingsSyncEventInput {
  eventCode: string;
  kind: QualificationRankingsSyncChangeKind;
}

type QualificationRankingsSyncSubscriber = (
  event: QualificationRankingsSyncEvent
) => void;

export interface QualificationRankingsSyncPublisher {
  getCurrentVersion: (eventCode: string) => number;
  publish: (
    input: PublishQualificationRankingsSyncEventInput
  ) => QualificationRankingsSyncEvent;
  subscribe: (
    eventCode: string,
    subscriber: QualificationRankingsSyncSubscriber
  ) => () => void;
}

const hub = new InMemorySyncHub<QualificationRankingsSyncEvent>();

export { hub };

export const createQualificationRankingsSnapshotHintEvent = (
  eventCode: string,
  version: number
): QualificationRankingsSyncEvent => ({
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SNAPSHOT_HINT",
  version,
});

export const qualificationRankingsSyncHub: QualificationRankingsSyncPublisher =
  {
    getCurrentVersion: (eventCode) => hub.getCurrentVersion(eventCode),
    publish: (input) =>
      hub.publish(input.eventCode, (version) => ({
        changedAt: new Date().toISOString(),
        eventCode: input.eventCode,
        kind: input.kind,
        version,
      })),
    subscribe: (eventCode, subscriber) => hub.subscribe(eventCode, subscriber),
  };
