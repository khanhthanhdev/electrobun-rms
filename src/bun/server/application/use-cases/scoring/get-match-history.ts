import type { MatchHistoryEventItem, MatchType } from "../../dtos/scoring";
import type { ScoringRepository } from "../../interfaces/scoring-repository";
import { normalizeScoringEventCode } from "./shared";

export interface GetMatchHistoryQuery {
  eventCode: string;
  matchNumber: number;
  matchType: MatchType;
}

export class GetMatchHistoryUseCase {
  constructor(private readonly scoringRepository: ScoringRepository) {}

  async execute(query: GetMatchHistoryQuery): Promise<MatchHistoryEventItem[]> {
    const history = await this.scoringRepository.getMatchHistory(
      normalizeScoringEventCode(query.eventCode),
      query.matchType,
      query.matchNumber
    );
    return history;
  }
}
