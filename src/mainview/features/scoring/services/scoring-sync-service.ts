import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import type {
  ScoringRealtimeChangeEvent,
  ScoringRealtimeChangeKind,
} from "../../../shared/types/scoring";
import type { ScoringRealtimeConnectionState } from "../state/scoring-sync-store";

const API_BASE_URL = "/api" as const;
const SCORING_CHANGE_EVENT_NAME = "scoring.change" as const;
const RECONNECT_DELAY_MS = 2000;

const VALID_CHANGE_KINDS = new Set<ScoringRealtimeChangeKind>([
  "SCORE_UPDATED",
  "SNAPSHOT_HINT",
]);

export class ScoringRealtimeFatalError extends Error {}

interface ConnectScoringRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: ScoringRealtimeChangeEvent) => void;
  onConnectionStateChange: (state: ScoringRealtimeConnectionState) => void;
  onError: (message: string) => void;
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
  signal,
  token,
}: ConnectScoringRealtimeOptions): Promise<void> => {
  onConnectionStateChange("connecting");

  const headers: Record<string, string> = {
    Accept: EventStreamContentType,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetchEventSource(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/scoring/stream`,
    {
      headers,
      method: "GET",
      onclose: () => {
        onConnectionStateChange("reconnecting");
        throw new Error("Scoring realtime stream closed.");
      },
      onerror: (error: unknown) => {
        if (error instanceof ScoringRealtimeFatalError) {
          onConnectionStateChange("stopped");
          onError(error.message);
          throw error;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Scoring realtime temporarily unavailable.";
        onConnectionStateChange("reconnecting");
        onError(message);
        return RECONNECT_DELAY_MS;
      },
      onmessage: (message) => {
        if (message.event !== SCORING_CHANGE_EVENT_NAME) {
          return;
        }

        const parsed = parseScoringRealtimeChangeEvent(message.data);
        if (!parsed) {
          return;
        }

        onChangeEvent(parsed);
        onError("");
      },
      onopen: (response) => {
        if (response.ok) {
          const contentType = response.headers.get("content-type");
          if (!contentType?.startsWith(EventStreamContentType)) {
            throw new Error(
              `Expected ${EventStreamContentType} but received ${contentType ?? "unknown"}.`
            );
          }
          onConnectionStateChange("connected");
          return Promise.resolve();
        }

        if (response.status === 401 || response.status === 403) {
          throw new ScoringRealtimeFatalError(
            "Realtime access denied for scoring stream."
          );
        }

        throw new Error(
          `Scoring realtime connection failed with status ${response.status}.`
        );
      },
      openWhenHidden: true,
      signal,
    }
  );
};
