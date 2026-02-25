import type {
  SaveMatchAllianceScoreInput,
  SaveMatchAllianceScoreResponse,
} from "../../services/event-scoring-service";
import { saveMatchAllianceScore } from "../../services/event-scoring-service";

export const saveEventMatchAllianceScore = (
  eventCode: string,
  payload: SaveMatchAllianceScoreInput
): SaveMatchAllianceScoreResponse => saveMatchAllianceScore(eventCode, payload);
