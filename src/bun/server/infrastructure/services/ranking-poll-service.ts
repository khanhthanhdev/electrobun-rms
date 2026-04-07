import { db, schema } from "../../../db";
import type {
  QualificationRankingsSyncChangeKind,
  QualificationRankingsSyncPublisher,
} from "../../api/events/rankings-sync";
import type {
  GetQualificationRankingSourceFingerprintUseCase,
  RebuildQualificationRankingsUseCase,
} from "../../application/use-cases/ranking";

interface MonitorState {
  inFlight: boolean;
  lastFingerprint: string | null;
}

interface RankingPollServiceDependencies {
  getFingerprintUseCase: GetQualificationRankingSourceFingerprintUseCase;
  hub: QualificationRankingsSyncPublisher;
  rebuildUseCase: RebuildQualificationRankingsUseCase;
}

const RANKING_SOURCE_POLL_INTERVAL_MS = 1500;

export class RankingPollService {
  private readonly monitorByEventCode = new Map<string, MonitorState>();
  private pollLoopInFlight = false;
  private intervalId: Timer | null = null;

  constructor(private readonly deps: RankingPollServiceDependencies) {}

  start(): void {
    this.intervalId = setInterval(() => {
      this.pollAllEvents().catch(() => undefined);
    }, RANKING_SOURCE_POLL_INTERVAL_MS);
    console.log(
      `[RankingPollService] Started polling at ${RANKING_SOURCE_POLL_INTERVAL_MS}ms interval`
    );
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log("[RankingPollService] Stopped polling");
    }
  }

  private async pollAllEvents(): Promise<void> {
    if (this.pollLoopInFlight) {
      return;
    }

    this.pollLoopInFlight = true;
    try {
      const eventRows = db
        .select({ code: schema.events.code })
        .from(schema.events)
        .all();
      const activeEventCodes = new Set<string>(
        eventRows.map((row) => row.code as string)
      );

      // Ensure monitor state exists for all active events
      for (const eventCode of activeEventCodes) {
        if (!this.monitorByEventCode.has(eventCode)) {
          this.monitorByEventCode.set(eventCode, {
            inFlight: false,
            lastFingerprint: null,
          });
        }
      }

      // Poll all active event sources
      for (const eventCode of activeEventCodes) {
        await this.pollEventSource(eventCode);
      }

      // Cleanup monitor state for removed events
      for (const eventCode of this.monitorByEventCode.keys()) {
        if (!activeEventCodes.has(eventCode)) {
          this.monitorByEventCode.delete(eventCode);
        }
      }
    } finally {
      this.pollLoopInFlight = false;
    }
  }

  private async pollEventSource(eventCode: string): Promise<void> {
    const state = this.monitorByEventCode.get(eventCode);
    if (!state || state.inFlight) {
      return;
    }

    state.inFlight = true;
    try {
      const currentFingerprint = await this.deps.getFingerprintUseCase.execute({
        eventCode,
      });

      // Seed on first pass and force one recompute to establish team_ranking.
      if (state.lastFingerprint === null) {
        await this.deps.rebuildUseCase.execute({ eventCode });
        state.lastFingerprint = currentFingerprint;
        return;
      }

      if (state.lastFingerprint === currentFingerprint) {
        return;
      }

      await this.deps.rebuildUseCase.execute({ eventCode });
      state.lastFingerprint = currentFingerprint;
      this.publishRankingsEvent(eventCode, "RANKINGS_UPDATED");
    } catch {
      // Ignore poll failures; the next interval will retry.
    } finally {
      state.inFlight = false;
    }
  }

  private publishRankingsEvent(
    eventCode: string,
    kind: QualificationRankingsSyncChangeKind
  ): void {
    this.deps.hub.publish({ eventCode, kind });
  }
}
