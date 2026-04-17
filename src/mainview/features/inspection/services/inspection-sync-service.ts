import {
  connectRealtimeStream,
  type RealtimeConnectionState,
  RealtimeFatalError,
} from "../../../shared/services/realtime-stream-service";
import type {
  InspectionRealtimeChangeEvent,
  InspectionRealtimeChangeKind,
} from "../../../shared/types/inspection";

export type InspectionRealtimeConnectionState = RealtimeConnectionState;

const INSPECTION_CHANGE_EVENT_NAME = "inspection.change" as const;

const VALID_CHANGE_KINDS = new Set<InspectionRealtimeChangeKind>([
  "ITEMS_UPDATED",
  "STATUS_UPDATED",
  "COMMENT_UPDATED",
  "OVERRIDE_APPLIED",
  "SNAPSHOT_HINT",
]);

export { RealtimeFatalError as InspectionRealtimeFatalError };

interface ConnectInspectionRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: InspectionRealtimeChangeEvent) => void;
  onConnectionStateChange: (state: InspectionRealtimeConnectionState) => void;
  onError: (message: string) => void;
  onReconnected?: () => void;
  signal: AbortSignal;
  token: string;
}

const parseInspectionRealtimeChangeEvent = (
  rawData: string
): InspectionRealtimeChangeEvent | null => {
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
  const teamNumber = event.teamNumber;

  if (
    typeof event.changedAt !== "string" ||
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_CHANGE_KINDS.has(kind as InspectionRealtimeChangeKind)
  ) {
    return null;
  }

  if (
    !(
      teamNumber === null ||
      (typeof teamNumber === "number" &&
        Number.isInteger(teamNumber) &&
        teamNumber > 0)
    )
  ) {
    return null;
  }

  return {
    changedAt: event.changedAt as string,
    eventCode: event.eventCode as string,
    kind: kind as InspectionRealtimeChangeKind,
    teamNumber: teamNumber as number | null,
    version: version as number,
  };
};

export const connectInspectionRealtime = async ({
  eventCode,
  onChangeEvent,
  onConnectionStateChange,
  onError,
  onReconnected,
  signal,
  token,
}: ConnectInspectionRealtimeOptions): Promise<void> =>
  connectRealtimeStream({
    eventCode,
    eventName: INSPECTION_CHANGE_EVENT_NAME,
    fatalErrorMessage: "Realtime access denied for inspection stream.",
    onChangeEvent,
    onConnectionStateChange,
    onError,
    onReconnected,
    parseEvent: parseInspectionRealtimeChangeEvent,
    signal,
    streamLabel: "Inspection",
    streamPath: "inspection/stream",
    token,
  });
