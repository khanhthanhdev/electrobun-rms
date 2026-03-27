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
const RECONNECT_DELAY_MS = 2000;

export interface ConnectRealtimeStreamOptions<TEvent> {
  eventCode: string;
  eventName: string;
  fatalErrorMessage: string;
  onChangeEvent: (event: TEvent) => void;
  onConnectionStateChange: (state: RealtimeConnectionState) => void;
  onError: (message: string) => void;
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
  parseEvent,
  signal,
  streamPath,
  streamLabel,
  token,
}: ConnectRealtimeStreamOptions<TEvent>): Promise<void> => {
  onConnectionStateChange("connecting");

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

        const message =
          error instanceof Error
            ? error.message
            : `${streamLabel} realtime temporarily unavailable.`;
        onConnectionStateChange("reconnecting");
        onError(message);
        return RECONNECT_DELAY_MS;
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
