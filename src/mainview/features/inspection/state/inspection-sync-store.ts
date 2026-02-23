import { createStore } from "tinybase";
import type { InspectionRealtimeChangeEvent } from "../../../shared/types/inspection";

const INSPECTION_REALTIME_TABLE_ID = "inspectionRealtime";
const CONNECTION_STATE_CELL_ID = "connectionState";
const LAST_ERROR_CELL_ID = "lastError";
const LAST_EVENT_AT_CELL_ID = "lastEventAt";
const LAST_EVENT_ID_CELL_ID = "lastEventId";
const LATEST_VERSION_CELL_ID = "latestVersion";

export type InspectionRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

const inspectionRealtimeStore = createStore();

const ensureInspectionRealtimeRow = (eventCode: string): void => {
  if (inspectionRealtimeStore.hasRow(INSPECTION_REALTIME_TABLE_ID, eventCode)) {
    return;
  }

  inspectionRealtimeStore.setRow(INSPECTION_REALTIME_TABLE_ID, eventCode, {
    [CONNECTION_STATE_CELL_ID]: "idle",
    [LAST_ERROR_CELL_ID]: "",
    [LAST_EVENT_AT_CELL_ID]: "",
    [LAST_EVENT_ID_CELL_ID]: "",
    [LATEST_VERSION_CELL_ID]: 0,
  });
};

const readNumberCell = (
  eventCode: string,
  cellId: string,
  defaultValue = 0
): number => {
  const value = inspectionRealtimeStore.getCell(
    INSPECTION_REALTIME_TABLE_ID,
    eventCode,
    cellId
  );
  return typeof value === "number" ? value : defaultValue;
};

export const getInspectionRealtimeVersion = (eventCode: string): number => {
  ensureInspectionRealtimeRow(eventCode);
  return readNumberCell(eventCode, LATEST_VERSION_CELL_ID, 0);
};

export const setInspectionRealtimeConnectionState = (
  eventCode: string,
  state: InspectionRealtimeConnectionState
): void => {
  ensureInspectionRealtimeRow(eventCode);
  inspectionRealtimeStore.setCell(
    INSPECTION_REALTIME_TABLE_ID,
    eventCode,
    CONNECTION_STATE_CELL_ID,
    state
  );
};

export const setInspectionRealtimeError = (
  eventCode: string,
  message: string
): void => {
  ensureInspectionRealtimeRow(eventCode);
  inspectionRealtimeStore.setCell(
    INSPECTION_REALTIME_TABLE_ID,
    eventCode,
    LAST_ERROR_CELL_ID,
    message
  );
};

export const applyInspectionRealtimeEvent = (
  event: InspectionRealtimeChangeEvent
): void => {
  ensureInspectionRealtimeRow(event.eventCode);

  const currentVersion = getInspectionRealtimeVersion(event.eventCode);
  const nextVersion =
    event.version > currentVersion ? event.version : currentVersion;

  inspectionRealtimeStore.transaction(() => {
    inspectionRealtimeStore.setCell(
      INSPECTION_REALTIME_TABLE_ID,
      event.eventCode,
      LAST_EVENT_AT_CELL_ID,
      event.changedAt
    );
    inspectionRealtimeStore.setCell(
      INSPECTION_REALTIME_TABLE_ID,
      event.eventCode,
      LAST_EVENT_ID_CELL_ID,
      `${event.eventCode}:${event.version}`
    );
    inspectionRealtimeStore.setCell(
      INSPECTION_REALTIME_TABLE_ID,
      event.eventCode,
      LATEST_VERSION_CELL_ID,
      nextVersion
    );
  });
};

export const subscribeToInspectionRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  ensureInspectionRealtimeRow(eventCode);
  const listenerId = inspectionRealtimeStore.addCellListener(
    INSPECTION_REALTIME_TABLE_ID,
    eventCode,
    LATEST_VERSION_CELL_ID,
    listener
  );
  return () => {
    inspectionRealtimeStore.delListener(listenerId);
  };
};
