import { createStore } from "tinybase";

const CONNECTION_STATE_CELL_ID = "connectionState";
const LAST_ERROR_CELL_ID = "lastError";
const LAST_EVENT_AT_CELL_ID = "lastEventAt";
const LAST_EVENT_ID_CELL_ID = "lastEventId";
const LATEST_VERSION_CELL_ID = "latestVersion";

export type GenericRealtimeConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error"
  | "stopped";

interface RealtimeVersionEvent {
  changedAt: string;
  eventCode: string;
  version: number;
}

export interface RealtimeVersionStore<TEvent extends RealtimeVersionEvent> {
  applyEvent: (event: TEvent) => void;
  getVersion: (eventCode: string) => number;
  resetVersion: (eventCode: string) => void;
  setConnectionState: (
    eventCode: string,
    state: GenericRealtimeConnectionState
  ) => void;
  setError: (eventCode: string, message: string) => void;
  subscribeToVersion: (eventCode: string, listener: () => void) => () => void;
}

export const createRealtimeVersionStore = <
  TEvent extends RealtimeVersionEvent,
>(
  tableId: string
): RealtimeVersionStore<TEvent> => {
  const store = createStore();

  const ensureRow = (eventCode: string): void => {
    if (store.hasRow(tableId, eventCode)) {
      return;
    }

    store.setRow(tableId, eventCode, {
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
    const value = store.getCell(tableId, eventCode, cellId);
    return typeof value === "number" ? value : defaultValue;
  };

  const applyEvent = (event: TEvent): void => {
    ensureRow(event.eventCode);

    store.transaction(() => {
      const currentVersion = readNumberCell(event.eventCode, LATEST_VERSION_CELL_ID, 0);

      if (event.version > currentVersion) {
        store.setCell(tableId, event.eventCode, LAST_EVENT_AT_CELL_ID, event.changedAt);
        store.setCell(
          tableId,
          event.eventCode,
          LAST_EVENT_ID_CELL_ID,
          `${event.eventCode}:${event.version}`
        );
        store.setCell(tableId, event.eventCode, LATEST_VERSION_CELL_ID, event.version);
      }
    });
  };

  const getVersion = (eventCode: string): number => {
    ensureRow(eventCode);
    return readNumberCell(eventCode, LATEST_VERSION_CELL_ID, 0);
  };

  const setConnectionState = (
    eventCode: string,
    state: GenericRealtimeConnectionState
  ): void => {
    ensureRow(eventCode);
    store.setCell(tableId, eventCode, CONNECTION_STATE_CELL_ID, state);
  };

  const setError = (eventCode: string, message: string): void => {
    ensureRow(eventCode);
    store.setCell(tableId, eventCode, LAST_ERROR_CELL_ID, message);
  };

  const resetVersion = (eventCode: string): void => {
    ensureRow(eventCode);
    store.setCell(tableId, eventCode, LATEST_VERSION_CELL_ID, 0);
  };

  const subscribeToVersion = (
    eventCode: string,
    listener: () => void
  ): (() => void) => {
    ensureRow(eventCode);
    const listenerId = store.addCellListener(
      tableId,
      eventCode,
      LATEST_VERSION_CELL_ID,
      listener
    );
    return () => {
      store.delListener(listenerId);
    };
  };

  return {
    applyEvent,
    getVersion,
    resetVersion,
    setConnectionState,
    setError,
    subscribeToVersion,
  };
};
