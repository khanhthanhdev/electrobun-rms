import { applyTeamAwardsSnapshot } from "./sync-event-db-award-sync";
import {
  applyInspectionResults,
  applyInspectionScheduleSnapshot,
} from "./sync-event-db-inspection-sync";
import { applyMatchResults } from "./sync-event-db-match-result-sync";
import { applyMatchScheduleSnapshot } from "./sync-event-db-match-schedule-sync";
import { applyTeamRankingsSnapshot } from "./sync-event-db-ranking-sync";
import { withEventDb } from "./sync-event-db-shared";
import { loadEventTeamDirectoryFromDb } from "./sync-event-db-team-directory";
import type {
  ApplyNotifications,
  StagedSyncChangeSet,
} from "./sync-event-db-types";

const applyChangeSet = (
  eventCode: string,
  teamDirectory: ReturnType<typeof loadEventTeamDirectoryFromDb>,
  notifications: ApplyNotifications,
  changeSet: StagedSyncChangeSet,
  eventDb: Parameters<typeof loadEventTeamDirectoryFromDb>[0]
): void => {
  if (changeSet.resourceType === "inspection_schedule") {
    applyInspectionScheduleSnapshot(eventDb, changeSet.records);
    return;
  }

  if (changeSet.resourceType === "inspection_results") {
    applyInspectionResults(eventDb, changeSet.records, notifications);
    return;
  }

  if (changeSet.resourceType === "match_schedule") {
    applyMatchScheduleSnapshot(eventDb, changeSet.records);
    return;
  }

  if (changeSet.resourceType === "match_results") {
    applyMatchResults(eventDb, changeSet.records, notifications);
    return;
  }

  if (changeSet.resourceType === "team_rankings") {
    applyTeamRankingsSnapshot(
      eventDb,
      eventCode,
      teamDirectory,
      changeSet.records,
      notifications
    );
    return;
  }

  if (changeSet.resourceType === "team_awards") {
    applyTeamAwardsSnapshot(
      eventDb,
      eventCode,
      teamDirectory,
      changeSet.records
    );
  }
};

export const applySyncChangeSetsToEventDb = (
  eventCode: string,
  changeSets: StagedSyncChangeSet[]
): ApplyNotifications => {
  const notifications: ApplyNotifications = {
    inspectionTeamNumbers: new Set<number>(),
    rankingUpdated: false,
    scoringUpdates: [],
  };

  withEventDb(eventCode, (eventDb) => {
    const teamDirectory = loadEventTeamDirectoryFromDb(eventDb);

    eventDb.exec("BEGIN TRANSACTION");
    try {
      for (const changeSet of changeSets) {
        applyChangeSet(
          eventCode,
          teamDirectory,
          notifications,
          changeSet,
          eventDb
        );
      }

      eventDb.exec("COMMIT");
    } catch (error) {
      eventDb.exec("ROLLBACK");
      throw error;
    }
  });
  return notifications;
};
