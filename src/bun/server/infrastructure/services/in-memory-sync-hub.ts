export interface SyncHubEvent {
  eventCode: string;
  version: number;
}

export type SyncSubscriber<TEvent> = (event: TEvent) => void;

export interface SyncPublisher<TEvent extends SyncHubEvent> {
  getCurrentVersion(eventCode: string): number;
  publish(eventCode: string, buildEvent: (version: number) => TEvent): TEvent;
  subscribe(eventCode: string, subscriber: SyncSubscriber<TEvent>): () => void;
}

export class InMemorySyncHub<TEvent extends SyncHubEvent>
  implements SyncPublisher<TEvent>
{
  private readonly subscribersByEventCode = new Map<
    string,
    Set<SyncSubscriber<TEvent>>
  >();

  private readonly versionByEventCode = new Map<string, number>();

  getCurrentVersion(eventCode: string): number {
    return this.versionByEventCode.get(eventCode) ?? 0;
  }

  publish(eventCode: string, buildEvent: (version: number) => TEvent): TEvent {
    const previousVersion = this.getCurrentVersion(eventCode);
    const nextVersion = Math.max(Date.now(), previousVersion + 1);
    this.versionByEventCode.set(eventCode, nextVersion);

    const event = buildEvent(nextVersion);

    const subscribers = this.subscribersByEventCode.get(eventCode);
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

  subscribe(eventCode: string, subscriber: SyncSubscriber<TEvent>): () => void {
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
