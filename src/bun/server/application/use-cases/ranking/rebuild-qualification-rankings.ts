import type { EventQualificationRankingsResponse } from "../../dtos/ranking";
import type { RankingRepository } from "../../interfaces/ranking-repository";
import {
  computeQualificationRankingSnapshot,
  normalizeRankingEventCode,
} from "./shared";

export interface RebuildQualificationRankingsCommand {
  eventCode: string;
}

export class RebuildQualificationRankingsUseCase {
  constructor(private readonly rankingRepository: RankingRepository) {}

  async execute(
    command: RebuildQualificationRankingsCommand
  ): Promise<EventQualificationRankingsResponse> {
    const eventCode = normalizeRankingEventCode(command.eventCode);
    const [teams, matches, existingRows] = await Promise.all([
      this.rankingRepository.loadRankingTeams(eventCode),
      this.rankingRepository.loadPostedQualificationMatches(eventCode),
      this.rankingRepository.loadStoredQualificationRankingSnapshots(eventCode),
    ]);
    const snapshot = computeQualificationRankingSnapshot({
      eventCode,
      teams,
      matches,
      existingRows,
    });

    await this.rankingRepository.replaceStoredQualificationRankings(
      eventCode,
      snapshot.persistedRows
    );

    return {
      eventCode,
      rankings: snapshot.rankings,
    };
  }
}
