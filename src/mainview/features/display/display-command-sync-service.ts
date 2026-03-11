/**
 * SSE client for receiving display commands from the server in real-time.
 * Enables cross-device control: control page on one device updates display on another.
 */
import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";
import type { DisplayCommand } from "./display-command-channel";
import type { DisplaySceneMode } from "./display-scene-types";

const API_BASE_URL = "/api" as const;
const DISPLAY_COMMAND_EVENT_NAME = "display.command" as const;
const RECONNECT_DELAY_MS = 2000;

export type DisplayCommandConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stopped";

export class DisplayCommandRealtimeFatalError extends Error {}

interface DisplaySyncEventPayload {
  changedAt: string;
  eventCode: string;
  kind: string;
  message: string | null;
  mode: DisplaySceneMode | null;
  startedAtMs: number | null;
  version: number;
}

const parseDisplaySyncEvent = (rawData: string): DisplayCommand | null => {
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
  const { kind, mode, message, startedAtMs } = payload;

  if (kind === "SNAPSHOT_HINT" && mode === null) {
    return null;
  }

  if (!mode) {
    return null;
  }

  if (mode === "text-notification") {
    return { mode: "text-notification", message: message ?? "" };
  }

  if (mode === "match-start") {
    if (startedAtMs === null || startedAtMs === undefined) {
      // No startedAtMs means "Show Match" (frozen timer at 2:30), not "Start Match".
      return { mode: "match-start" };
    }
    return { mode: "match-start", startedAtMs };
  }

  return { mode };
};

interface ConnectDisplayCommandRealtimeOptions {
  eventCode: string;
  onCommand: (command: DisplayCommand) => void;
  onConnectionStateChange: (state: DisplayCommandConnectionState) => void;
  onError: (message: string) => void;
  signal: AbortSignal;
  token: string | null;
}

export const connectDisplayCommandRealtime = async ({
  eventCode,
  onCommand,
  onConnectionStateChange,
  onError,
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
        if (message.event !== DISPLAY_COMMAND_EVENT_NAME) {
          return;
        }

        const command = parseDisplaySyncEvent(message.data);
        if (!command) {
          return;
        }

        onCommand(command);
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
