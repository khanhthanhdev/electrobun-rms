import type { DisplaySceneMode } from "@shared/display";

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

class InMemoryDisplaySyncHub implements DisplaySyncPublisher {
  private readonly latestByEventCode = new Map<string, DisplaySyncEvent>();

  private readonly subscribersByEventCode = new Map<
    string,
    Set<DisplaySyncSubscriber>
  >();

  private readonly versionByEventCode = new Map<string, number>();

  getCurrentVersion(eventCode: string): number {
    return this.versionByEventCode.get(eventCode) ?? 0;
  }

  getLatestEvent(eventCode: string): DisplaySyncEvent | null {
    return this.latestByEventCode.get(eventCode) ?? null;
  }

  publish(input: PublishDisplaySyncEventInput): DisplaySyncEvent {
    const previousVersion = this.getCurrentVersion(input.eventCode);
    const nextVersion = Math.max(Date.now(), previousVersion + 1);
    this.versionByEventCode.set(input.eventCode, nextVersion);

    const event: DisplaySyncEvent = {
      changedAt: new Date().toISOString(),
      eventCode: input.eventCode,
      kind: input.kind,
      matchNumber: input.matchNumber ?? null,
      matchType: input.matchType ?? null,
      message: input.message ?? null,
      mode: input.mode ?? null,
      startedAtMs: input.startedAtMs ?? null,
      version: nextVersion,
    };

    this.latestByEventCode.set(input.eventCode, event);

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

  subscribe(eventCode: string, subscriber: DisplaySyncSubscriber): () => void {
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

export const displaySyncHub: DisplaySyncPublisher =
  new InMemoryDisplaySyncHub();

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
