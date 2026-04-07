import type { ScoreBreakdown } from "../../domain/season-rules";
import type {
  MatchHistoryEventItem,
  MatchResultItem,
  MatchScoresheet,
  MatchType,
  SaveMatchAllianceScoreInput,
} from "../dtos/scoring";

export interface PersistedAllianceScoreResult {
  bluePenaltyCommitted: number;
  blueScore: number;
  redPenaltyCommitted: number;
  redScore: number;
}

/**
 * Repository interface for scoring operations.
 * Implemented by infrastructure layer (e.g., SQLiteScoringRepository).
 */
export interface ScoringRepository {
  /**
   * Get scoring history for a match (all submissions).
   */
  getMatchHistory(
    eventCode: string,
    matchType: MatchType,
    matchNumber: number
  ): Promise<MatchHistoryEventItem[]>;

  /**
   * Get posted results for a match type.
   */
  getMatchResults(
    eventCode: string,
    matchType: MatchType
  ): Promise<MatchResultItem[]>;

  /**
   * Get complete scoresheet for a match.
   */
  getMatchScoresheet(
    eventCode: string,
    matchType: MatchType,
    matchNumber: number
  ): Promise<MatchScoresheet>;
  /**
   * Save alliance score for a match.
   */
  saveAllianceScore(
    eventCode: string,
    input: SaveMatchAllianceScoreInput,
    scoreBreakdown: ScoreBreakdown
  ): Promise<PersistedAllianceScoreResult>;

  /**
   * Clear all scores for a specific match (game-specific + results rows).
   * Used when a match is aborted so replayed matches start from zero.
   */
  clearMatchScores(
    eventCode: string,
    matchType: MatchType,
    matchNumber: number
  ): Promise<void>;
}
