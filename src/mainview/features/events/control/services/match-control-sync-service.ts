import type { MatchControlState } from "@shared/match-control";
import {
  connectRealtimeStream,
  type RealtimeConnectionState,
} from "../../../../shared/services/realtime-stream-service";

export type MatchControlRealtimeConnectionState = RealtimeConnectionState;

const MATCH_CONTROL_STATE_EVENT_NAME = "match-control.state" as const;

type MatchControlSyncEventKind = "STATE_CHANGED" | "SNAPSHOT_HINT";

export interface MatchControlRealtimeChangeEvent {
  eventCode: string;
  kind: MatchControlSyncEventKind;
  state: MatchControlState | null;
  version: number;
}

export class MatchControlRealtimeFatalError extends Error {}

interface ConnectMatchControlRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: MatchControlRealtimeChangeEvent) => void;
  onConnectionStateChange: (state: MatchControlRealtimeConnectionState) => void;
  onError: (message: string) => void;
  onReconnected?: () => void;
  signal: AbortSignal;
  token: string | null;
}

const VALID_KINDS = new Set<MatchControlSyncEventKind>([
  "STATE_CHANGED",
  "SNAPSHOT_HINT",
]);

const parseMatchControlState = (value: unknown): MatchControlState | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const s = value as Record<string, unknown>;
  if (typeof s.eventCode !== "string" || typeof s.version !== "number") {
    return null;
  }
  return value as MatchControlState;
};

const parseMatchControlRealtimeEvent = (
  rawData: string
): MatchControlRealtimeChangeEvent | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const event = parsed as Record<string, unknown>;
  const kind = event.kind;
  const version = event.version;

  if (
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_KINDS.has(kind as MatchControlSyncEventKind)
  ) {
    return null;
  }

  return {
    eventCode: event.eventCode as string,
    kind: kind as MatchControlSyncEventKind,
    state: parseMatchControlState(event.state),
    version: version as number,
  };
};

export const connectMatchControlRealtime = async ({
  eventCode,
  onChangeEvent,
  onConnectionStateChange,
  onError,
  onReconnected,
  signal,
  token,
}: ConnectMatchControlRealtimeOptions): Promise<void> =>
  connectRealtimeStream({
    eventCode,
    eventName: MATCH_CONTROL_STATE_EVENT_NAME,
    fatalErrorMessage: "Realtime access denied for match control stream.",
    onChangeEvent,
    onConnectionStateChange,
    onError,
    onReconnected,
    parseEvent: parseMatchControlRealtimeEvent,
    signal,
    streamLabel: "Match Control",
    streamPath: "match-control/stream",
    token,
  });
