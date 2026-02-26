import { createStore } from "tinybase";
import type { ScoringRealtimeChangeEvent } from "../../../shared/types/scoring";

const SCORING_REALTIME_TABLE_ID = "scoringRealtime";
const CONNECTION_STATE_CELL_ID = "connectionState";
const LAST_ERROR_CELL_ID = "lastError";
const LAST_EVENT_AT_CELL_ID = "lastEventAt";
const LAST_EVENT_ID_CELL_ID = "lastEventId";
const LATEST_VERSION_CELL_ID = "latestVersion";

export type ScoringRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

const scoringRealtimeStore = createStore();

const ensureScoringRealtimeRow = (eventCode: string): void => {
  if (scoringRealtimeStore.hasRow(SCORING_REALTIME_TABLE_ID, eventCode)) {
    return;
  }

  scoringRealtimeStore.setRow(SCORING_REALTIME_TABLE_ID, eventCode, {
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
  const value = scoringRealtimeStore.getCell(
    SCORING_REALTIME_TABLE_ID,
    eventCode,
    cellId
  );
  return typeof value === "number" ? value : defaultValue;
};

export const getScoringRealtimeVersion = (eventCode: string): number => {
  ensureScoringRealtimeRow(eventCode);
  return readNumberCell(eventCode, LATEST_VERSION_CELL_ID, 0);
};

export const setScoringRealtimeConnectionState = (
  eventCode: string,
  state: ScoringRealtimeConnectionState
): void => {
  ensureScoringRealtimeRow(eventCode);
  scoringRealtimeStore.setCell(
    SCORING_REALTIME_TABLE_ID,
    eventCode,
    CONNECTION_STATE_CELL_ID,
    state
  );
};

export const setScoringRealtimeError = (
  eventCode: string,
  message: string
): void => {
  ensureScoringRealtimeRow(eventCode);
  scoringRealtimeStore.setCell(
    SCORING_REALTIME_TABLE_ID,
    eventCode,
    LAST_ERROR_CELL_ID,
    message
  );
};

export const applyScoringRealtimeEvent = (
  event: ScoringRealtimeChangeEvent
): void => {
  ensureScoringRealtimeRow(event.eventCode);

  scoringRealtimeStore.transaction(() => {
    const currentVersion = readNumberCell(
      event.eventCode,
      LATEST_VERSION_CELL_ID,
      0
    );

    if (event.version > currentVersion) {
      scoringRealtimeStore.setCell(
        SCORING_REALTIME_TABLE_ID,
        event.eventCode,
        LAST_EVENT_AT_CELL_ID,
        event.changedAt
      );
      scoringRealtimeStore.setCell(
        SCORING_REALTIME_TABLE_ID,
        event.eventCode,
        LAST_EVENT_ID_CELL_ID,
        `${event.eventCode}:${event.version}`
      );
      scoringRealtimeStore.setCell(
        SCORING_REALTIME_TABLE_ID,
        event.eventCode,
        LATEST_VERSION_CELL_ID,
        event.version
      );
    }
  });
};

export const subscribeToScoringRealtimeVersion = (
  eventCode: string,
  listener: () => void
): (() => void) => {
  ensureScoringRealtimeRow(eventCode);
  const listenerId = scoringRealtimeStore.addCellListener(
    SCORING_REALTIME_TABLE_ID,
    eventCode,
    LATEST_VERSION_CELL_ID,
    listener
  );
  return () => {
    scoringRealtimeStore.delListener(listenerId);
  };
};
