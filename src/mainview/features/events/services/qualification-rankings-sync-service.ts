import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import type { QualificationRankingRealtimeChangeEvent } from "../../../shared/types/ranking";
import type { QualificationRankingsRealtimeConnectionState } from "../state/qualification-rankings-sync-store";

const API_BASE_URL = "/api" as const;
const QUALIFICATION_RANKINGS_CHANGE_EVENT_NAME =
  "qualification-rankings.change" as const;
const RECONNECT_DELAY_MS = 2000;

const VALID_CHANGE_KINDS = new Set<
  QualificationRankingRealtimeChangeEvent["kind"]
>(["RANKINGS_UPDATED", "SNAPSHOT_HINT"]);

export class QualificationRankingsRealtimeFatalError extends Error {}

interface ConnectQualificationRankingsRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: QualificationRankingRealtimeChangeEvent) => void;
  onConnectionStateChange: (
    state: QualificationRankingsRealtimeConnectionState
  ) => void;
  onError: (message: string) => void;
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
  signal,
  token,
}: ConnectQualificationRankingsRealtimeOptions): Promise<void> => {
  onConnectionStateChange("connecting");

  const headers: Record<string, string> = {
    Accept: EventStreamContentType,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetchEventSource(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/qualification-rankings/stream`,
    {
      headers,
      method: "GET",
      onclose: () => {
        onConnectionStateChange("reconnecting");
        throw new Error("Qualification rankings realtime stream closed.");
      },
      onerror: (error: unknown) => {
        if (error instanceof QualificationRankingsRealtimeFatalError) {
          onConnectionStateChange("stopped");
          onError(error.message);
          throw error;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Qualification rankings realtime temporarily unavailable.";
        onConnectionStateChange("reconnecting");
        onError(message);
        return RECONNECT_DELAY_MS;
      },
      onmessage: (message) => {
        if (message.event !== QUALIFICATION_RANKINGS_CHANGE_EVENT_NAME) {
          return;
        }

        const parsed = parseQualificationRankingRealtimeChangeEvent(
          message.data
        );
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
          throw new QualificationRankingsRealtimeFatalError(
            "Realtime access denied for qualification rankings stream."
          );
        }

        throw new Error(
          `Qualification rankings realtime connection failed with status ${response.status}.`
        );
      },
      openWhenHidden: true,
      signal,
    }
  );
};
