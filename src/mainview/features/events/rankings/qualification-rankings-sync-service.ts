import {
  connectRealtimeStream,
  type RealtimeConnectionState,
  RealtimeFatalError,
} from "@/shared/services/realtime-stream-service";
import type { QualificationRankingRealtimeChangeEvent } from "@/shared/types/ranking";
export type QualificationRankingsRealtimeConnectionState =
  RealtimeConnectionState;
const QUALIFICATION_RANKINGS_CHANGE_EVENT_NAME =
  "qualification-rankings.change" as const;

const VALID_CHANGE_KINDS = new Set<
  QualificationRankingRealtimeChangeEvent["kind"]
>(["RANKINGS_UPDATED", "SNAPSHOT_HINT"]);

export { RealtimeFatalError as QualificationRankingsRealtimeFatalError };

interface ConnectQualificationRankingsRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: QualificationRankingRealtimeChangeEvent) => void;
  onConnectionStateChange: (
    state: QualificationRankingsRealtimeConnectionState
  ) => void;
  onError: (message: string) => void;
  onReconnected?: () => void;
  signal: AbortSignal;
  token: string | null;
}

const parseQualificationRankingRealtimeChangeEvent = (
  rawData: string
): QualificationRankingRealtimeChangeEvent | null => {
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
    typeof event.changedAt !== "string" ||
    typeof event.eventCode !== "string" ||
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 0 ||
    !VALID_CHANGE_KINDS.has(
      kind as QualificationRankingRealtimeChangeEvent["kind"]
    )
  ) {
    return null;
  }

  return {
    changedAt: event.changedAt,
    eventCode: event.eventCode,
    kind,
    version,
  } as QualificationRankingRealtimeChangeEvent;
};

export const connectQualificationRankingsRealtime = async ({
  eventCode,
  onChangeEvent,
  onConnectionStateChange,
  onError,
  onReconnected,
  signal,
  token,
}: ConnectQualificationRankingsRealtimeOptions): Promise<void> =>
  connectRealtimeStream({
    eventCode,
    eventName: QUALIFICATION_RANKINGS_CHANGE_EVENT_NAME,
    fatalErrorMessage:
      "Realtime access denied for qualification rankings stream.",
    onChangeEvent,
    onConnectionStateChange,
    onError,
    onReconnected,
    parseEvent: parseQualificationRankingRealtimeChangeEvent,
    signal,
    streamLabel: "Qualification rankings",
    streamPath: "qualification-rankings/stream",
    token,
  });
