import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import type {
  InspectionRealtimeChangeEvent,
  InspectionRealtimeChangeKind,
} from "../../../shared/types/inspection";
import type { InspectionRealtimeConnectionState } from "../state/inspection-sync-store";

const API_BASE_URL = "/api" as const;
const INSPECTION_CHANGE_EVENT_NAME = "inspection.change" as const;
const RECONNECT_DELAY_MS = 2000;

const VALID_CHANGE_KINDS = new Set<InspectionRealtimeChangeKind>([
  "ITEMS_UPDATED",
  "STATUS_UPDATED",
  "COMMENT_UPDATED",
  "OVERRIDE_APPLIED",
  "SNAPSHOT_HINT",
]);

export class InspectionRealtimeFatalError extends Error {}

interface ConnectInspectionRealtimeOptions {
  eventCode: string;
  onChangeEvent: (event: InspectionRealtimeChangeEvent) => void;
  onConnectionStateChange: (state: InspectionRealtimeConnectionState) => void;
  onError: (message: string) => void;
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

  const parsedTeamNumber = teamNumber === null ? null : (teamNumber as number);
  const parsedVersion = version as number;

  return {
    changedAt: event.changedAt as string,
    eventCode: event.eventCode as string,
    kind: kind as InspectionRealtimeChangeKind,
    teamNumber: parsedTeamNumber,
    version: parsedVersion,
  };
};

export const connectInspectionRealtime = async ({
  eventCode,
  onChangeEvent,
  onConnectionStateChange,
  onError,
  signal,
  token,
}: ConnectInspectionRealtimeOptions): Promise<void> => {
  onConnectionStateChange("connecting");

  await fetchEventSource(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/inspection/stream`,
    {
      headers: {
        Accept: EventStreamContentType,
        Authorization: `Bearer ${token}`,
      },
      method: "GET",
      onclose: () => {
        onConnectionStateChange("reconnecting");
        throw new Error("Inspection realtime stream closed.");
      },
      onerror: (error: unknown) => {
        if (error instanceof InspectionRealtimeFatalError) {
          onConnectionStateChange("stopped");
          onError(error.message);
          throw error;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Inspection realtime temporarily unavailable.";
        onConnectionStateChange("reconnecting");
        onError(message);
        return RECONNECT_DELAY_MS;
      },
      onmessage: (message) => {
        if (message.event !== INSPECTION_CHANGE_EVENT_NAME) {
          return;
        }

        const parsed = parseInspectionRealtimeChangeEvent(message.data);
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
          throw new InspectionRealtimeFatalError(
            "Realtime access denied for inspection stream."
          );
        }

        throw new Error(
          `Inspection realtime connection failed with status ${response.status}.`
        );
      },
      openWhenHidden: true,
      signal,
    }
  );
};
