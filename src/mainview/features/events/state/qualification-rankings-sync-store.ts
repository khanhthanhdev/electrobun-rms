import { createStore } from "tinybase";
import type { QualificationRankingRealtimeChangeEvent } from "../../../shared/types/ranking";

const QUALIFICATION_RANKINGS_REALTIME_TABLE_ID =
  "qualificationRankingsRealtime";
const CONNECTION_STATE_CELL_ID = "connectionState";
const LAST_ERROR_CELL_ID = "lastError";
const LAST_EVENT_AT_CELL_ID = "lastEventAt";
const LAST_EVENT_ID_CELL_ID = "lastEventId";
const LATEST_VERSION_CELL_ID = "latestVersion";

export type QualificationRankingsRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

const qualificationRankingsRealtimeStore = createStore();

const ensureQualificationRankingsRealtimeRow = (eventCode: string): void => {
  if (
    qualificationRankingsRealtimeStore.hasRow(
      QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
      eventCode
    )
  ) {
    return;
  }

  qualificationRankingsRealtimeStore.setRow(
    QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
    eventCode,
    {
      [CONNECTION_STATE_CELL_ID]: "idle",
      [LAST_ERROR_CELL_ID]: "",
      [LAST_EVENT_AT_CELL_ID]: "",
      [LAST_EVENT_ID_CELL_ID]: "",
      [LATEST_VERSION_CELL_ID]: 0,
    }
  );
};

const readNumberCell = (
  eventCode: string,
  cellId: string,
  defaultValue = 0
): number => {
  const value = qualificationRankingsRealtimeStore.getCell(
    QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
    eventCode,
    cellId
  );
  return typeof value === "number" ? value : defaultValue;
};

export const getQualificationRankingsRealtimeVersion = (
  eventCode: string
): number => {
  ensureQualificationRankingsRealtimeRow(eventCode);
  return readNumberCell(eventCode, LATEST_VERSION_CELL_ID, 0);
};

export const setQualificationRankingsRealtimeConnectionState = (
  eventCode: string,
  state: QualificationRankingsRealtimeConnectionState
): void => {
  ensureQualificationRankingsRealtimeRow(eventCode);
  qualificationRankingsRealtimeStore.setCell(
    QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
    eventCode,
    CONNECTION_STATE_CELL_ID,
    state
  );
};

export const setQualificationRankingsRealtimeError = (
  eventCode: string,
  message: string
): void => {
  ensureQualificationRankingsRealtimeRow(eventCode);
  qualificationRankingsRealtimeStore.setCell(
    QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
    eventCode,
    LAST_ERROR_CELL_ID,
    message
  );
};

export const applyQualificationRankingsRealtimeEvent = (
  event: QualificationRankingRealtimeChangeEvent
): void => {
  ensureQualificationRankingsRealtimeRow(event.eventCode);

  qualificationRankingsRealtimeStore.transaction(() => {
    const currentVersion = readNumberCell(
      event.eventCode,
      LATEST_VERSION_CELL_ID,
      0
    );
    const nextVersion =
      event.version > currentVersion ? event.version : currentVersion;

    qualificationRankingsRealtimeStore.setCell(
      QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
      event.eventCode,
      LAST_EVENT_AT_CELL_ID,
      event.changedAt
    );
    qualificationRankingsRealtimeStore.setCell(
      QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
      event.eventCode,
      LAST_EVENT_ID_CELL_ID,
      `${event.eventCode}:${event.version}`
    );
    qualificationRankingsRealtimeStore.setCell(
      QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
      event.eventCode,
      LATEST_VERSION_CELL_ID,
      nextVersion
    );
  });
};

export const subscribeToQualificationRankingsRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  ensureQualificationRankingsRealtimeRow(eventCode);
  const listenerId = qualificationRankingsRealtimeStore.addCellListener(
    QUALIFICATION_RANKINGS_REALTIME_TABLE_ID,
    eventCode,
    LATEST_VERSION_CELL_ID,
    listener
  );
  return () => {
    qualificationRankingsRealtimeStore.delListener(listenerId);
  };
};
