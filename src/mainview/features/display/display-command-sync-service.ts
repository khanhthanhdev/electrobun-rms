/**
 * SSE client for receiving display commands from the server in real-time.
 * Enables cross-device control: control page on one device updates display on another.
 */
import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import {
  type DisplayCommand,
  normalizeDisplayCommand,
} from "./display-command-channel";
import type { DisplaySceneMode } from "./display-scene-types";

const API_BASE_URL = "/api" as const;
const DISPLAY_COMMAND_EVENT_NAME = "display.command" as const;
const SCORE_UPDATE_EVENT_NAME = "display.change" as const;
const RECONNECT_DELAY_MS = 2000;

export type DisplayCommandConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stopped";

export class DisplayCommandRealtimeFatalError extends Error {}

export interface ScoreUpdateEvent {
  changedAt: string;
  eventCode: string;
  kind: "SCORE_UPDATE";
  matchNumber: number | null;
  matchType: string | null;
  version: number;
}

interface DisplaySyncEventPayload {
  activeMatch?: unknown;
  changedAt: string;
  eventCode: string;
  kind: string;
  loadedMatch?: unknown;
  message: string | null;
  mode: DisplaySceneMode | null;
  startedAtMs: number | null;
  version: number;
}

export const parseDisplaySyncEvent = (
  rawData: string
): DisplayCommand | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const payload = parsed as DisplaySyncEventPayload;
  const { activeMatch, kind, loadedMatch, message, mode, startedAtMs } =
    payload;

  if (kind === "SNAPSHOT_HINT" && mode === null) {
    return null;
  }

  if (typeof mode !== "string") {
    return null;
  }

  return normalizeDisplayCommand({
    activeMatch,
    loadedMatch,
    message,
    mode,
    startedAtMs,
  });
};

export const parseScoreUpdateEvent = (
  rawData: string
): ScoreUpdateEvent | null => {
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
    kind !== "SCORE_UPDATE"
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
    kind: kind as "SCORE_UPDATE",
    matchNumber: matchNumber as number | null,
    matchType: matchType as string | null,
    version: version as number,
  };
};

interface ConnectDisplayCommandRealtimeOptions {
  eventCode: string;
  onCommand: (command: DisplayCommand) => void;
  onConnectionStateChange: (state: DisplayCommandConnectionState) => void;
  onError: (message: string) => void;
  onScoreUpdate?: (event: ScoreUpdateEvent) => void;
  signal: AbortSignal;
  token: string | null;
}

export const connectDisplayCommandRealtime = async ({
  eventCode,
  onCommand,
  onConnectionStateChange,
  onError,
  onScoreUpdate,
  signal,
  token,
}: ConnectDisplayCommandRealtimeOptions): Promise<void> => {
  onConnectionStateChange("connecting");

  const headers: Record<string, string> = {
    Accept: EventStreamContentType,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetchEventSource(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/display/stream`,
    {
      headers,
      method: "GET",
      onclose: () => {
        onConnectionStateChange("reconnecting");
        throw new Error("Display command realtime stream closed.");
      },
      onerror: (error: unknown) => {
        if (error instanceof DisplayCommandRealtimeFatalError) {
          onConnectionStateChange("stopped");
          onError(error.message);
          throw error;
        }

        const msg =
          error instanceof Error
            ? error.message
            : "Display command realtime temporarily unavailable.";
        onConnectionStateChange("reconnecting");
        onError(msg);
        return RECONNECT_DELAY_MS;
      },
      onmessage: (message) => {
        if (message.event === DISPLAY_COMMAND_EVENT_NAME) {
          const command = parseDisplaySyncEvent(message.data);
          if (command) {
            onCommand(command);
            onError("");
          }
          return;
        }

        if (message.event === SCORE_UPDATE_EVENT_NAME) {
          const scoreUpdate = parseScoreUpdateEvent(message.data);
          if (scoreUpdate) {
            onScoreUpdate?.(scoreUpdate);
            onError("");
          }
          return;
        }
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
          throw new DisplayCommandRealtimeFatalError(
            "Realtime access denied for display command stream."
          );
        }

        throw new Error(
          `Display command realtime connection failed with status ${response.status}.`
        );
      },
      openWhenHidden: true,
      signal,
    }
  );
};
