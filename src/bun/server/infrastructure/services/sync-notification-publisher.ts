import { qualificationRankingsSyncHub } from "../../api/events/rankings-sync";
import { inspectionSyncHub } from "../../api/inspection/inspection-sync";
import { scoringSyncHub } from "../../api/scoring/scoring-sync";
import type { ApplyNotifications } from "../../application/dtos/sync";
import type { SyncNotificationPublisher } from "../../application/interfaces/sync-notification-publisher";

class SyncHubNotificationPublisher implements SyncNotificationPublisher {
  publishNotifications(
    eventCode: string,
    notifications: ApplyNotifications
  ): void {
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
  }
}

const syncNotificationPublisher = new SyncHubNotificationPublisher();

export const publishNotifications = (
  eventCode: string,
  notifications: ApplyNotifications
): void =>
  syncNotificationPublisher.publishNotifications(eventCode, notifications);
