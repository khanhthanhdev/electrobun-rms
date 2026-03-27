import type { AllianceColor, MatchType } from "./scoring-types";

/**
 * Input DTO for submitting alliance score.
 */
export interface SaveMatchAllianceScoreInput {
  aCenterFlags: number;
  aFirstTierFlags: number;
  alliance: AllianceColor;
  aSecondTierFlags: number;
  bBaseFlagsDown: number;
  bCenterFlagDown: number;
  cOpponentBackfieldBullets: number;
  dGoldFlagsDefended: number;
  dRobotParkState: number;
  matchNumber: number;
  matchType: MatchType;
}

/**
 * Match history item.
 */
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

/**
 * Single alliance scoresheet item.
 */
export type MatchScoresheetItem = MatchHistoryItem;

/**
 * Output DTO for match scoresheet.
 */
export interface MatchScoresheet {
  blue: MatchHistoryItem | null;
  red: MatchHistoryItem | null;
}

/**
 * Match history event item.
 */
export interface MatchHistoryEventItem {
  blueScore: number | null;
  redScore: number | null;
  scoresheetAlliance: AllianceColor;
  ts: number;
  type: string;
}

/**
 * Match result item (used in results list).
 */
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

/**
 * Response DTO for saving alliance score.
 */
export interface SaveMatchAllianceScoreResponse {
  alliance: AllianceColor;
  eventCode: string;
  gameSpecific: {
    aCenterFlags: number;
    aFirstTierFlags: number;
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
  };
  matchNumber: number;
  matchType: MatchType;
  result: {
    bluePenaltyCommitted: number;
    blueScore: number;
    redPenaltyCommitted: number;
    redScore: number;
  };
}
