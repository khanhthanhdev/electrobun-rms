import type {
  InspectionChecklistResponse,
  InspectionDetailResponse,
  InspectionHistoryResponse,
  InspectionItemUpdate,
  InspectionStatus,
  InspectionTeamsResponse,
  PublicInspectionStatusResponse,
} from "../dtos/inspection";

export interface InspectionRepository {
  /**
   * Get inspection checklist configuration.
   */
  getChecklist(): InspectionChecklistResponse;

  /**
   * Get detailed inspection data for a specific team.
   */
  getInspectionDetail(
    eventCode: string,
    teamNumber: number
  ): InspectionDetailResponse;

  /**
   * Get inspection history for a team.
   */
  getInspectionHistory(
    eventCode: string,
    teamNumber: number
  ): InspectionHistoryResponse;

  /**
   * Get public inspection status (no auth required).
   */
  getPublicInspectionStatus(eventCode: string): PublicInspectionStatusResponse;

  /**
   * List all teams with their inspection status summary.
   */
  listInspectionTeams(
    eventCode: string,
    search?: string
  ): InspectionTeamsResponse;

  /**
   * Apply lead inspector override to pass a team.
   */
  overrideInspectionStatus(
    eventCode: string,
    teamNumber: number,
    comment: string,
    changedBy: string
  ): InspectionDetailResponse;

  /**
   * Save inspection comment for a team.
   */
  saveInspectionComment(
    eventCode: string,
    teamNumber: number,
    comment: string
  ): void;

  /**
   * Update inspection items (responses) for a team.
   */
  updateInspectionItems(
    eventCode: string,
    teamNumber: number,
    items: InspectionItemUpdate[]
  ): InspectionDetailResponse;

  /**
   * Update inspection status for a team.
   */
  updateInspectionStatus(
    eventCode: string,
    teamNumber: number,
    status: InspectionStatus,
    changedBy: string
  ): InspectionDetailResponse;
}
