import { InMemorySyncHub } from "../../infrastructure/services/in-memory-sync-hub";

export const INSPECTION_SYNC_EVENT_NAME = "inspection.change" as const;

export type InspectionSyncChangeKind =
  | "ITEMS_UPDATED"
  | "STATUS_UPDATED"
  | "COMMENT_UPDATED"
  | "OVERRIDE_APPLIED";

export type InspectionSyncEventKind =
  | InspectionSyncChangeKind
  | "SNAPSHOT_HINT";

export interface InspectionSyncEvent {
  changedAt: string;
  eventCode: string;
  kind: InspectionSyncEventKind;
  teamNumber: number | null;
  version: number;
}

export interface PublishInspectionSyncEventInput {
  eventCode: string;
  kind: InspectionSyncChangeKind;
  teamNumber?: number | null;
}

type InspectionSyncSubscriber = (event: InspectionSyncEvent) => void;

export interface InspectionSyncPublisher {
  getCurrentVersion: (eventCode: string) => number;
  publish: (input: PublishInspectionSyncEventInput) => InspectionSyncEvent;
  subscribe: (
    eventCode: string,
    subscriber: InspectionSyncSubscriber
  ) => () => void;
}

const hub = new InMemorySyncHub<InspectionSyncEvent>();

export const inspectionSyncHub: InspectionSyncPublisher = {
  getCurrentVersion: (eventCode) => hub.getCurrentVersion(eventCode),

  publish: (input) =>
    hub.publish(input.eventCode, (version) => ({
      changedAt: new Date().toISOString(),
      eventCode: input.eventCode,
      kind: input.kind,
      teamNumber: input.teamNumber ?? null,
      version,
    })),

  subscribe: (eventCode, subscriber) => hub.subscribe(eventCode, subscriber),
};

export const createInspectionSnapshotHintEvent = (
  eventCode: string,
  version: number
): InspectionSyncEvent => ({
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SNAPSHOT_HINT",
  teamNumber: null,
  version,
});
