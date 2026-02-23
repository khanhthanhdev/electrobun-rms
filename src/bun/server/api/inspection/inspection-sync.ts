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

class InMemoryInspectionSyncHub implements InspectionSyncPublisher {
  private readonly subscribersByEventCode = new Map<
    string,
    Set<InspectionSyncSubscriber>
  >();

  private readonly versionByEventCode = new Map<string, number>();

  getCurrentVersion(eventCode: string): number {
    return this.versionByEventCode.get(eventCode) ?? 0;
  }

  publish(input: PublishInspectionSyncEventInput): InspectionSyncEvent {
    const previousVersion = this.getCurrentVersion(input.eventCode);
    const nextVersion = Math.max(Date.now(), previousVersion + 1);
    this.versionByEventCode.set(input.eventCode, nextVersion);

    const event: InspectionSyncEvent = {
      changedAt: new Date().toISOString(),
      eventCode: input.eventCode,
      kind: input.kind,
      teamNumber: input.teamNumber ?? null,
      version: nextVersion,
    };

    const subscribers = this.subscribersByEventCode.get(input.eventCode);
    if (!subscribers || subscribers.size === 0) {
      return event;
    }

    for (const subscriber of subscribers) {
      try {
        subscriber(event);
      } catch {
        // Ignore subscriber failures so one broken client does not block others.
      }
    }

    return event;
  }

  subscribe(
    eventCode: string,
    subscriber: InspectionSyncSubscriber
  ): () => void {
    const existingSubscribers = this.subscribersByEventCode.get(eventCode);
    if (existingSubscribers) {
      existingSubscribers.add(subscriber);
    } else {
      this.subscribersByEventCode.set(eventCode, new Set([subscriber]));
    }

    return () => {
      const subscribers = this.subscribersByEventCode.get(eventCode);
      if (!subscribers) {
        return;
      }

      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.subscribersByEventCode.delete(eventCode);
      }
    };
  }
}

export const inspectionSyncHub: InspectionSyncPublisher =
  new InMemoryInspectionSyncHub();

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
