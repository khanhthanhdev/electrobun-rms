import { qualificationRankingsSyncHub } from "../events/rankings-sync";
import { inspectionSyncHub } from "../inspection/inspection-sync";
import { scoringSyncHub } from "../scoring/scoring-sync";
import type { ApplyNotifications } from "./sync-event-db-types";

export const publishNotifications = (
  eventCode: string,
  notifications: ApplyNotifications
): void => {
  for (const teamNumber of notifications.inspectionTeamNumbers) {
    inspectionSyncHub.publish({
      eventCode,
      kind: "STATUS_UPDATED",
      teamNumber,
    });
  }

  for (const update of notifications.scoringUpdates) {
    scoringSyncHub.publish({
      eventCode,
      kind: "SCORE_UPDATED",
      matchNumber: update.matchNumber,
      matchType: update.matchType,
    });
  }

  if (notifications.rankingUpdated) {
    qualificationRankingsSyncHub.publish({
      eventCode,
      kind: "RANKINGS_UPDATED",
    });
  }
};
