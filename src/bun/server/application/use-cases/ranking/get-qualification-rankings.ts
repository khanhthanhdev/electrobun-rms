import type { EventQualificationRankingsResponse } from "../../dtos/ranking";
import type { RankingRepository } from "../../interfaces/ranking-repository";
import { normalizeRankingEventCode } from "./shared";

export interface GetQualificationRankingsQuery {
  eventCode: string;
}

export class GetQualificationRankingsUseCase {
  constructor(private readonly rankingRepository: RankingRepository) {}

  async execute(
    query: GetQualificationRankingsQuery
  ): Promise<EventQualificationRankingsResponse> {
    const eventCode = normalizeRankingEventCode(query.eventCode);
    const rankings =
      await this.rankingRepository.loadStoredQualificationRankings(eventCode);

    return { eventCode, rankings };
  }
}
