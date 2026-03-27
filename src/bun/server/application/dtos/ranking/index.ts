export interface QualificationRankingItem {
  losses: number;
  name: string;
  played: number;
  rank: number;
  rankingPoint: number;
  teamNumber: number;
  ties: number;
  total: number;
  wins: number;
}

export interface EventQualificationRankingsResponse {
  eventCode: string;
  rankings: QualificationRankingItem[];
}

export interface RankingTeam {
  fmsTeamId: string;
  name: string;
  teamNumber: number;
}

export interface PostedQualificationMatch {
  bluePenaltyCommitted: number;
  blueScore: number;
  blueSurrogate: number;
  blueTeam: number;
  matchNumber: number;
  postedTime: number;
  redPenaltyCommitted: number;
  redScore: number;
  redSurrogate: number;
  redTeam: number;
}

export interface PersistedTeamRankingSnapshot {
  fmsEventId: string | null;
  fmsTeamId: string;
  pointsScoredAverage: string | null;
  rank: number;
}

export interface TeamRankingRowToPersist {
  disqualified: number;
  fmsEventId: string;
  fmsTeamId: string;
  losses: number;
  matchesCounted: number;
  matchesPlayed: number;
  modifiedOn: string;
  pointsScoredAverage: string;
  pointsScoredAverageChange: number;
  pointsScoredTotal: number;
  qualifyingScore: string;
  rankChange: number;
  ranking: number;
  sortOrder1: string;
  sortOrder2: string;
  sortOrder3: string;
  sortOrder4: string;
  sortOrder5: string;
  sortOrder6: string;
  ties: number;
  wins: number;
}

export interface RankingSourceFingerprint {
  bluePenaltyCommittedSum: number;
  blueScoreSum: number;
  matchCount: number;
  maxPostedTime: number;
  redPenaltyCommittedSum: number;
  redScoreSum: number;
  weightedSignature: number;
}

export interface QualificationRankingSourceFingerprintInput {
  hasPostedSourceTables: boolean;
  lineupsCount: number;
  source: RankingSourceFingerprint;
  teamCount: number;
}
