import type {
  MatchHistoryEventItem,
  MatchResultItem,
  MatchScoresheet,
  MatchType,
  SaveMatchAllianceScoreInput,
  SaveMatchAllianceScoreResponse,
} from "../../services/event-scoring-service";
import {
  getMatchHistory,
  getMatchResults,
  getMatchScoresheet,
  saveMatchAllianceScore,
} from "../../services/event-scoring-service";

export const getEventMatchResults = (
  eventCode: string,
  matchType: MatchType
): MatchResultItem[] => getMatchResults(eventCode, matchType);

export const getEventMatchHistory = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number
): MatchHistoryEventItem[] =>
  getMatchHistory(eventCode, matchType, matchNumber);

export const getEventMatchScoresheet = (
  eventCode: string,
  matchType: MatchType,
  matchNumber: number
): MatchScoresheet => getMatchScoresheet(eventCode, matchType, matchNumber);

export const saveEventMatchAllianceScore = (
  eventCode: string,
  payload: SaveMatchAllianceScoreInput
): SaveMatchAllianceScoreResponse => saveMatchAllianceScore(eventCode, payload);
