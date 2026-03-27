import type { StagedSyncChangeSet } from "../../application/dtos/sync";
import { applySyncChangeSetsToEventDb as applySyncChangeSetsToEventDbAdapter } from "../../infrastructure/adapters/sync";
import { publishNotifications } from "../../infrastructure/services/sync-notification-publisher";

export const applySyncChangeSetsToEventDb = (
  eventCode: string,
  changeSets: StagedSyncChangeSet[]
): void => {
  const notifications = applySyncChangeSetsToEventDbAdapter(
    eventCode,
    changeSets
  );
  publishNotifications(eventCode, notifications);
};

export type {
  EventTeamDirectoryEntry,
  StagedSyncChangeSet,
} from "../../application/dtos/sync";
export { loadEventTeamDirectory } from "../../infrastructure/adapters/sync";
