import type { MatchControlState } from "@shared/match-control";
import { createStore } from "tinybase";

const MATCH_CONTROL_REALTIME_TABLE_ID = "matchControlRealtime";
const CONNECTION_STATE_CELL_ID = "connectionState";
const LAST_ERROR_CELL_ID = "lastError";
const LATEST_VERSION_CELL_ID = "latestVersion";
const STATE_JSON_CELL_ID = "stateJson";

export type MatchControlRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

const matchControlRealtimeStore = createStore();

const ensureMatchControlRealtimeRow = (eventCode: string): void => {
  if (
    matchControlRealtimeStore.hasRow(
      MATCH_CONTROL_REALTIME_TABLE_ID,
      eventCode
    )
  ) {
    return;
  }

  matchControlRealtimeStore.setRow(MATCH_CONTROL_REALTIME_TABLE_ID, eventCode, {
    [CONNECTION_STATE_CELL_ID]: "idle",
    [LAST_ERROR_CELL_ID]: "",
    [LATEST_VERSION_CELL_ID]: 0,
    [STATE_JSON_CELL_ID]: "",
  });
};

const readNumberCell = (
  eventCode: string,
  cellId: string,
  defaultValue = 0
): number => {
  const value = matchControlRealtimeStore.getCell(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    cellId
  );
  return typeof value === "number" ? value : defaultValue;
};

export const getMatchControlRealtimeVersion = (eventCode: string): number => {
  ensureMatchControlRealtimeRow(eventCode);
  return readNumberCell(eventCode, LATEST_VERSION_CELL_ID, 0);
};

export const getMatchControlRealtimeState = (
  eventCode: string
): MatchControlState | null => {
  ensureMatchControlRealtimeRow(eventCode);
  const raw = matchControlRealtimeStore.getCell(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    STATE_JSON_CELL_ID
  );
  if (typeof raw !== "string" || raw === "") {
    return null;
  }
  try {
    return JSON.parse(raw) as MatchControlState;
  } catch {
    return null;
  }
};

export const setMatchControlRealtimeConnectionState = (
  eventCode: string,
  state: MatchControlRealtimeConnectionState
): void => {
  ensureMatchControlRealtimeRow(eventCode);
  matchControlRealtimeStore.setCell(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    CONNECTION_STATE_CELL_ID,
    state
  );
};

export const setMatchControlRealtimeError = (
  eventCode: string,
  message: string
): void => {
  ensureMatchControlRealtimeRow(eventCode);
  matchControlRealtimeStore.setCell(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    LAST_ERROR_CELL_ID,
    message
  );
};

export const applyMatchControlRealtimeEvent = (
  eventCode: string,
  version: number
): void => {
  ensureMatchControlRealtimeRow(eventCode);

  const currentVersion = readNumberCell(
    eventCode,
    LATEST_VERSION_CELL_ID,
    0
  );

  if (version > currentVersion) {
    matchControlRealtimeStore.setCell(
      MATCH_CONTROL_REALTIME_TABLE_ID,
      eventCode,
      LATEST_VERSION_CELL_ID,
      version
    );
  }
};

export const applyMatchControlRealtimeState = (
  eventCode: string,
  version: number,
  state: MatchControlState
): void => {
  ensureMatchControlRealtimeRow(eventCode);

  const currentVersion = readNumberCell(
    eventCode,
    LATEST_VERSION_CELL_ID,
    0
  );

  if (version > currentVersion) {
    matchControlRealtimeStore.setPartialRow(
      MATCH_CONTROL_REALTIME_TABLE_ID,
      eventCode,
      {
        [LATEST_VERSION_CELL_ID]: version,
        [STATE_JSON_CELL_ID]: JSON.stringify(state),
      }
    );
  }
};

export const resetMatchControlRealtimeVersion = (
  eventCode: string
): void => {
  ensureMatchControlRealtimeRow(eventCode);
  matchControlRealtimeStore.setCell(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    LATEST_VERSION_CELL_ID,
    0
  );
};

export const subscribeToMatchControlRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  ensureMatchControlRealtimeRow(eventCode);
  const listenerId = matchControlRealtimeStore.addCellListener(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    LATEST_VERSION_CELL_ID,
    listener
  );
  return () => {
    matchControlRealtimeStore.delListener(listenerId);
  };
};

export const subscribeToMatchControlRealtimeState = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  ensureMatchControlRealtimeRow(eventCode);
  const listenerId = matchControlRealtimeStore.addCellListener(
    MATCH_CONTROL_REALTIME_TABLE_ID,
    eventCode,
    STATE_JSON_CELL_ID,
    listener
  );
  return () => {
    matchControlRealtimeStore.delListener(listenerId);
  };
};
