import {
  connectRealtimeStream,
  RealtimeFatalError,
  type RealtimeConnectionState,
} from "../../../shared/services/realtime-stream-service";
import type {
  ScoringRealtimeChangeEvent,
  ScoringRealtimeChangeKind,
} from "../../../shared/types/scoring";

export type ScoringRealtimeConnectionState = RealtimeConnectionState;

const SCORING_CHANGE_EVENT_NAME = "scoring.change" as const;

const VALID_CHANGE_KINDS = new Set<ScoringRealtimeChangeKind>([
  "SCORE_UPDATED",
  "SNAPSHOT_HINT",
]);

export { RealtimeFatalError as ScoringRealtimeFatalError };

interface ConnectScoringRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: ScoringRealtimeChangeEvent) => void;
  onConnectionStateChange: (state: ScoringRealtimeConnectionState) => void;
  onError: (message: string) => void;
  onReconnected?: () => void;
  signal: AbortSignal;
  token: string | null;
}

const parseScoringRealtimeChangeEvent = (
  rawData: string
): ScoringRealtimeChangeEvent | null => {
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
  const matchNumber = event.matchNumber;
  const matchType = event.matchType;

  if (
    typeof event.changedAt !== "string" ||
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_CHANGE_KINDS.has(kind as ScoringRealtimeChangeKind)
  ) {
    return null;
  }

  if (
    !(
      matchNumber === null ||
      (typeof matchNumber === "number" &&
        Number.isInteger(matchNumber) &&
        matchNumber > 0)
    )
  ) {
    return null;
  }

  if (!(matchType === null || typeof matchType === "string")) {
    return null;
  }

  return {
    changedAt: event.changedAt as string,
    eventCode: event.eventCode as string,
    kind: kind as ScoringRealtimeChangeKind,
    matchNumber: matchNumber as number | null,
    matchType: matchType as string | null,
    version: version as number,
  };
};

export const connectScoringRealtime = async ({
  eventCode,
  onChangeEvent,
  onConnectionStateChange,
  onError,
  onReconnected,
  signal,
  token,
}: ConnectScoringRealtimeOptions): Promise<void> =>
  connectRealtimeStream({
    eventCode,
    eventName: SCORING_CHANGE_EVENT_NAME,
    fatalErrorMessage: "Realtime access denied for scoring stream.",
    onChangeEvent,
    onConnectionStateChange,
    onError,
    onReconnected,
    parseEvent: parseScoringRealtimeChangeEvent,
    signal,
    streamLabel: "Scoring",
    streamPath: "scoring/stream",
    token,
  });
