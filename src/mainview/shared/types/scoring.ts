export type ScoringRealtimeChangeKind = "SCORE_UPDATED" | "SNAPSHOT_HINT";

export interface ScoringRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: ScoringRealtimeChangeKind;
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

export type MatchType = "practice" | "quals" | "elims";
export type AllianceColor = "red" | "blue";

export interface MatchResultItem {
  blueScore: number | null;
  blueSurrogate: boolean;
  blueTeam: number;
  blueTeamName: string;
  matchNumber: number;
  redScore: number | null;
  redSurrogate: boolean;
  redTeam: number;
  redTeamName: string;
}

export interface MatchHistoryEventItem {
  blueScore: number | null;
  redScore: number | null;
  scoresheetAlliance: AllianceColor;
  ts: number;
  type: string;
}

export interface MatchHistoryItem {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: AllianceColor;
  aSecondTierFlags: number;
  bBaseFlagsDown: number;
  bCenterFlagDown: number;
  cOpponentBackfieldBullets: number;
  dGoldFlagsDefended: number;
  dRobotParkState: number;
  scoreA: number;
  scoreB: number;
  scoreC: number;
  scoreD: number;
  scoreTotal: number;
  ts: number;
}

export interface MatchScoresheet {
  blue: MatchHistoryItem | null;
  red: MatchHistoryItem | null;
}
