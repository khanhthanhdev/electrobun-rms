export interface ScoreBreakdown {
  scoreA: number;
  scoreB: number;
  scoreC: number;
  scoreD: number;
  scoreTotal: number;
}

export interface ScoreMetricDefinition {
  key: string;
  label: string;
  maxValue?: number;
  minValue: number;
}

export interface MatchFormatRules {
  allianceColors: readonly string[];
  allowSurrogates: boolean;
  supportedMatchTypes: readonly string[];
  teamsPerAlliance: number;
}

export interface TimingRules {
  defaultCycleTimeSecondsByType: Record<string, number>;
  defaultFieldStartOffsetSecondsByType: Record<string, number>;
  defaultMatchesPerTeam: number;
  matchDurationSeconds: number;
}

export interface ScoringRules {
  computeAllianceScore: (input: Record<string, number>) => ScoreBreakdown;
  metrics: ScoreMetricDefinition[];
}

export interface RankingAccumulatorState {
  losses: number;
  matchesCounted: number;
  matchesPlayed: number;
  pointsScoredAverage: number;
  pointsScoredTotal: number;
  qualifyingScore: number;
  teamNumber: number;
  ties: number;
  wins: number;
}

export interface PostedMatchResult {
  blueScore: number;
  blueSurrogate: number;
  blueTeam: number;
  redScore: number;
  redSurrogate: number;
  redTeam: number;
}

export interface RankingRules {
  accumulateMatch: (
    accumulators: Map<number, RankingAccumulatorState>,
    match: PostedMatchResult,
    getOrCreate: (teamNumber: number) => RankingAccumulatorState
  ) => void;
  buildSortOrders: (team: RankingAccumulatorState) => string[];
  finalize: (accumulator: RankingAccumulatorState) => void;
  sort: (teams: RankingAccumulatorState[]) => RankingAccumulatorState[];
}

export interface SeasonRuleSet {
  matchFormat: MatchFormatRules;
  ranking: RankingRules;
  scoring: ScoringRules;
  seasonId: string;
  timing: TimingRules;
}
