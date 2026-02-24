import { db, schema } from "../../../db";
import {
  getQualificationRankingSourceFingerprint,
  recomputeEventQualificationRankings,
} from "../../services/event-rankings-service";

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

interface MonitorState {
  inFlight: boolean;
  lastFingerprint: string | null;
}

const RANKING_SOURCE_POLL_INTERVAL_MS = 1500;

class InMemoryQualificationRankingsSyncHub
  implements QualificationRankingsSyncPublisher
{
  private readonly subscribersByEventCode = new Map<
    string,
    Set<QualificationRankingsSyncSubscriber>
  >();

  private readonly versionByEventCode = new Map<string, number>();

  private readonly monitorByEventCode = new Map<string, MonitorState>();

  private pollLoopInFlight = false;

  constructor() {
    setInterval(() => {
      this.pollAllEvents();
    }, RANKING_SOURCE_POLL_INTERVAL_MS);
  }

  getCurrentVersion(eventCode: string): number {
    return this.versionByEventCode.get(eventCode) ?? 0;
  }

  publish(
    input: PublishQualificationRankingsSyncEventInput
  ): QualificationRankingsSyncEvent {
    const previousVersion = this.getCurrentVersion(input.eventCode);
    const nextVersion = Math.max(Date.now(), previousVersion + 1);
    this.versionByEventCode.set(input.eventCode, nextVersion);

    const event: QualificationRankingsSyncEvent = {
      changedAt: new Date().toISOString(),
      eventCode: input.eventCode,
      kind: input.kind,
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
    subscriber: QualificationRankingsSyncSubscriber
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
      if (subscribers.size > 0) {
        return;
      }

      this.subscribersByEventCode.delete(eventCode);
    };
  }

  private pollAllEvents(): void {
    if (this.pollLoopInFlight) {
      return;
    }

    this.pollLoopInFlight = true;
    try {
      const eventRows = db
        .select({ code: schema.events.code })
        .from(schema.events)
        .all();
      const activeEventCodes = new Set(eventRows.map((row) => row.code));

      for (const eventCode of activeEventCodes) {
        if (!this.monitorByEventCode.has(eventCode)) {
          this.monitorByEventCode.set(eventCode, {
            inFlight: false,
            lastFingerprint: null,
          });
        }

        this.pollEventSource(eventCode);
      }

      for (const eventCode of this.monitorByEventCode.keys()) {
        if (activeEventCodes.has(eventCode)) {
          continue;
        }

        this.monitorByEventCode.delete(eventCode);
        this.subscribersByEventCode.delete(eventCode);
        this.versionByEventCode.delete(eventCode);
      }
    } finally {
      this.pollLoopInFlight = false;
    }
  }

  private pollEventSource(eventCode: string): void {
    const state = this.monitorByEventCode.get(eventCode);
    if (!state || state.inFlight) {
      return;
    }

    state.inFlight = true;
    try {
      const currentFingerprint =
        getQualificationRankingSourceFingerprint(eventCode);

      // Seed on first pass and force one recompute to establish team_ranking.
      if (state.lastFingerprint === null) {
        recomputeEventQualificationRankings(eventCode);
        state.lastFingerprint = currentFingerprint;
        return;
      }

      if (state.lastFingerprint === currentFingerprint) {
        return;
      }

      recomputeEventQualificationRankings(eventCode);
      state.lastFingerprint = currentFingerprint;
      this.publish({
        eventCode,
        kind: "RANKINGS_UPDATED",
      });
    } catch {
      // Ignore poll failures; the next interval will retry.
    } finally {
      state.inFlight = false;
    }
  }
}

export const qualificationRankingsSyncHub: QualificationRankingsSyncPublisher =
  new InMemoryQualificationRankingsSyncHub();

export const createQualificationRankingsSnapshotHintEvent = (
  eventCode: string,
  version: number
): QualificationRankingsSyncEvent => ({
  changedAt: new Date().toISOString(),
  eventCode,
  kind: "SNAPSHOT_HINT",
  version,
});
