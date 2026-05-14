import {
  EventStreamContentType,
  fetchEventSource,
} from "@microsoft/fetch-event-source";

export type RealtimeConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "stopped";

export class RealtimeFatalError extends Error {}

const API_BASE_URL = "/api" as const;
const BASE_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const BACKOFF_MULTIPLIER = 2;

export interface ConnectRealtimeStreamOptions<TEvent> {
  eventCode: string;
  eventName: string;
  fatalErrorMessage: string;
  onChangeEvent: (event: TEvent) => void;
  onConnectionStateChange: (state: RealtimeConnectionState) => void;
  onError: (message: string) => void;
  onReconnected?: () => void;
  parseEvent: (rawData: string) => TEvent | null;
  signal: AbortSignal;
  streamLabel: string;
  streamPath: string;
  token: string | null;
}

export const connectRealtimeStream = async <TEvent>({
  eventCode,
  eventName,
  fatalErrorMessage,
  onChangeEvent,
  onConnectionStateChange,
  onError,
  onReconnected,
  parseEvent,
  signal,
  streamPath,
  streamLabel,
  token,
}: ConnectRealtimeStreamOptions<TEvent>): Promise<void> => {
  onConnectionStateChange("connecting");
  let hasConnectedBefore = false;
  let consecutiveFailures = 0;

  const headers: Record<string, string> = {
    Accept: EventStreamContentType,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  await fetchEventSource(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/${streamPath}`,
    {
      headers,
      method: "GET",
      onclose: () => {
        onConnectionStateChange("reconnecting");
        throw new Error(`${streamLabel} realtime stream closed.`);
      },
      onerror: (error: unknown) => {
        if (error instanceof RealtimeFatalError) {
          onConnectionStateChange("stopped");
          onError(error.message);
          throw error;
        }

        consecutiveFailures++;
        const delay = Math.min(
          BASE_RECONNECT_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, consecutiveFailures - 1),
          MAX_RECONNECT_DELAY_MS
        );

        const message =
          error instanceof Error
            ? error.message
            : `${streamLabel} realtime temporarily unavailable.`;
        onConnectionStateChange("reconnecting");
        onError(message);
        return delay;
      },
      onmessage: (message) => {
        if (message.event !== eventName) {
          return;
        }

        const parsed = parseEvent(message.data);
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

          if (hasConnectedBefore) {
            onReconnected?.();
          }
          hasConnectedBefore = true;
          consecutiveFailures = 0;

          onConnectionStateChange("connected");
          return Promise.resolve();
        }

        if (response.status === 401 || response.status === 403) {
          throw new RealtimeFatalError(fatalErrorMessage);
        }

        throw new Error(
          `${streamLabel} realtime connection failed with status ${response.status}.`
        );
      },
      openWhenHidden: true,
      signal,
    }
  );
};
