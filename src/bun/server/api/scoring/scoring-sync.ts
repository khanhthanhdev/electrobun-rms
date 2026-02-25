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

class InMemoryScoringSyncHub implements ScoringSyncPublisher {
  private readonly subscribersByEventCode = new Map<
    string,
    Set<ScoringSyncSubscriber>
  >();

  private readonly versionByEventCode = new Map<string, number>();

  getCurrentVersion(eventCode: string): number {
    return this.versionByEventCode.get(eventCode) ?? 0;
  }

  publish(input: PublishScoringSyncEventInput): ScoringSyncEvent {
    const previousVersion = this.getCurrentVersion(input.eventCode);
    const nextVersion = Math.max(Date.now(), previousVersion + 1);
    this.versionByEventCode.set(input.eventCode, nextVersion);

    const event: ScoringSyncEvent = {
      changedAt: new Date().toISOString(),
      eventCode: input.eventCode,
      kind: input.kind,
      matchNumber: input.matchNumber ?? null,
      matchType: input.matchType ?? null,
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

  subscribe(eventCode: string, subscriber: ScoringSyncSubscriber): () => void {
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

export const scoringSyncHub: ScoringSyncPublisher =
  new InMemoryScoringSyncHub();

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
