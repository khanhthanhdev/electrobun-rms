import { createStore } from "tinybase";

const DISPLAY_REALTIME_TABLE_ID = "displayRealtime";
const CONNECTION_STATE_CELL_ID = "connectionState";
const LAST_ERROR_CELL_ID = "lastError";
const LAST_EVENT_AT_CELL_ID = "lastEventAt";
const LAST_EVENT_ID_CELL_ID = "lastEventId";
const LATEST_VERSION_CELL_ID = "latestVersion";

export type DisplayRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

const displayRealtimeStore = createStore();

const ensureDisplayRealtimeRow = (eventCode: string): void => {
  if (displayRealtimeStore.hasRow(DISPLAY_REALTIME_TABLE_ID, eventCode)) {
    return;
  }

  displayRealtimeStore.setRow(DISPLAY_REALTIME_TABLE_ID, eventCode, {
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
  const value = displayRealtimeStore.getCell(
    DISPLAY_REALTIME_TABLE_ID,
    eventCode,
    cellId
  );
  return typeof value === "number" ? value : defaultValue;
};

export const getDisplayRealtimeVersion = (eventCode: string): number => {
  ensureDisplayRealtimeRow(eventCode);
  return readNumberCell(eventCode, LATEST_VERSION_CELL_ID, 0);
};

export const setDisplayRealtimeConnectionState = (
  eventCode: string,
  state: DisplayRealtimeConnectionState
): void => {
  ensureDisplayRealtimeRow(eventCode);
  displayRealtimeStore.setCell(
    DISPLAY_REALTIME_TABLE_ID,
    eventCode,
    CONNECTION_STATE_CELL_ID,
    state
  );
};

export const setDisplayRealtimeError = (
  eventCode: string,
  message: string
): void => {
  ensureDisplayRealtimeRow(eventCode);
  displayRealtimeStore.setCell(
    DISPLAY_REALTIME_TABLE_ID,
    eventCode,
    LAST_ERROR_CELL_ID,
    message
  );
};

export interface DisplayRealtimeChangeEvent {
  changedAt: string;
  eventCode: string;
  kind: "SCORE_UPDATE";
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

export const applyDisplayRealtimeEvent = (
  event: DisplayRealtimeChangeEvent
): void => {
  ensureDisplayRealtimeRow(event.eventCode);

  displayRealtimeStore.transaction(() => {
    const currentVersion = readNumberCell(
      event.eventCode,
      LATEST_VERSION_CELL_ID,
      0
    );

    if (event.version > currentVersion) {
      displayRealtimeStore.setCell(
        DISPLAY_REALTIME_TABLE_ID,
        event.eventCode,
        LAST_EVENT_AT_CELL_ID,
        event.changedAt
      );
      displayRealtimeStore.setCell(
        DISPLAY_REALTIME_TABLE_ID,
        event.eventCode,
        LAST_EVENT_ID_CELL_ID,
        `${event.eventCode}:${event.version}`
      );
      displayRealtimeStore.setCell(
        DISPLAY_REALTIME_TABLE_ID,
        event.eventCode,
        LATEST_VERSION_CELL_ID,
        event.version
      );
    }
  });
};

export const subscribeToDisplayRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  ensureDisplayRealtimeRow(eventCode);
  const listenerId = displayRealtimeStore.addCellListener(
    DISPLAY_REALTIME_TABLE_ID,
    eventCode,
    LATEST_VERSION_CELL_ID,
    listener
  );
  return () => {
    displayRealtimeStore.delListener(listenerId);
  };
};
