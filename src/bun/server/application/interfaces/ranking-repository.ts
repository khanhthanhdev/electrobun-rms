import type {
  PersistedTeamRankingSnapshot,
  PostedQualificationMatch,
  QualificationRankingItem,
  QualificationRankingSourceFingerprintInput,
  RankingTeam,
  TeamRankingRowToPersist,
} from "../dtos/ranking";

export interface RankingRepository {
  loadPostedQualificationMatches(
    eventCode: string
  ): Promise<PostedQualificationMatch[]>;

  loadQualificationRankingSourceFingerprint(
    eventCode: string
  ): Promise<QualificationRankingSourceFingerprintInput>;

  loadRankingTeams(eventCode: string): Promise<RankingTeam[]>;

  loadStoredQualificationRankingSnapshots(
    eventCode: string
  ): Promise<PersistedTeamRankingSnapshot[]>;

  loadStoredQualificationRankings(
    eventCode: string
  ): Promise<QualificationRankingItem[]>;

  replaceStoredQualificationRankings(
    eventCode: string,
    rows: TeamRankingRowToPersist[]
  ): Promise<void>;
}
