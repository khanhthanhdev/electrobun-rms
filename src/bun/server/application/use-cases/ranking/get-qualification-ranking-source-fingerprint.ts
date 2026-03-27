import type { RankingRepository } from "../../interfaces/ranking-repository";
import {
  buildQualificationRankingSourceFingerprint,
  normalizeRankingEventCode,
} from "./shared";

export interface GetQualificationRankingSourceFingerprintQuery {
  eventCode: string;
}

export class GetQualificationRankingSourceFingerprintUseCase {
  constructor(private readonly rankingRepository: RankingRepository) {}

  async execute(
    query: GetQualificationRankingSourceFingerprintQuery
  ): Promise<string> {
    const eventCode = normalizeRankingEventCode(query.eventCode);
    const fingerprint =
      await this.rankingRepository.loadQualificationRankingSourceFingerprint(
        eventCode
      );

    return buildQualificationRankingSourceFingerprint(fingerprint);
  }
}
