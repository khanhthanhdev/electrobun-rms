import type { MatchResultItem, MatchType } from "../../dtos/scoring";
import type { ScoringRepository } from "../../interfaces/scoring-repository";
import { normalizeScoringEventCode } from "./shared";

export interface GetMatchResultsQuery {
  eventCode: string;
  matchType: MatchType;
}

export class GetMatchResultsUseCase {
  constructor(private readonly scoringRepository: ScoringRepository) {}

  async execute(query: GetMatchResultsQuery): Promise<MatchResultItem[]> {
    const results = await this.scoringRepository.getMatchResults(
      normalizeScoringEventCode(query.eventCode),
      query.matchType
    );
    return results;
  }
}
