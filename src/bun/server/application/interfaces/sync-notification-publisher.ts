import type { ApplyNotifications } from "../dtos/sync";

export interface SyncNotificationPublisher {
  publishNotifications(
    eventCode: string,
    notifications: ApplyNotifications
  ): void;
}
