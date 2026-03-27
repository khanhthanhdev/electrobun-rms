import type { MatchScoresheet, MatchType } from "../../dtos/scoring";
import type { ScoringRepository } from "../../interfaces/scoring-repository";
import { normalizeScoringEventCode } from "./shared";

export interface GetMatchScoresheetQuery {
  eventCode: string;
  matchNumber: number;
  matchType: MatchType;
}

export class GetMatchScoresheetUseCase {
  constructor(private readonly scoringRepository: ScoringRepository) {}

  async execute(query: GetMatchScoresheetQuery): Promise<MatchScoresheet> {
    const scoresheet = await this.scoringRepository.getMatchScoresheet(
      normalizeScoringEventCode(query.eventCode),
      query.matchType,
      query.matchNumber
    );
    return scoresheet;
  }
}
