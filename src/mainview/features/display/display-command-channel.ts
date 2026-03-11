/**
 * Command channel for control page -> display page sync.
 *
 * Primary channel: HTTP POST to server SSE hub (cross-device, cross-browser).
 * Fallback channel: BroadcastChannel + localStorage (same-browser, zero-latency).
 *
 * Both channels fire in parallel on publish so the same-browser display
 * updates instantly while cross-device displays update via SSE.
 */

import type { DisplaySceneMode } from "@shared/display";

const CHANNEL_NAME = "audience-display-command";
const STORAGE_KEY_PREFIX = "audience-display:";
const API_BASE_URL = "/api" as const;

export type DisplayCommand =
  | { mode: DisplaySceneMode }
  | { mode: "match-start"; startedAtMs: number }
  | { mode: "text-notification"; message: string };

export type DisplayCommandPayload = DisplayCommand & { eventCode: string };

const toStorageKey = (eventCode: string): string =>
  `${STORAGE_KEY_PREFIX}${eventCode}`;

let publishChannel: BroadcastChannel | null = null;

const getPublishChannel = (): BroadcastChannel | null => {
  if (publishChannel) {
    return publishChannel;
  }
  try {
    publishChannel = new BroadcastChannel(CHANNEL_NAME);
    return publishChannel;
  } catch {
    return null;
  }
};

const publishLocalCommand = (
  eventCode: string,
  command: DisplayCommand
): void => {
  const payload: DisplayCommandPayload = { ...command, eventCode };
  const serialized = JSON.stringify(payload);

  getPublishChannel()?.postMessage(payload);

  try {
    localStorage.setItem(toStorageKey(eventCode), serialized);
  } catch {
    // localStorage full or unavailable
  }
};

/**
 * Publish a display command via the server API (cross-device SSE).
 * Requires a valid auth token. Fire-and-forget; errors are silently ignored
 * so the local BroadcastChannel fallback still works without network.
 */
const publishDisplayCommandViaApi = (
  eventCode: string,
  command: DisplayCommand,
  token: string
): void => {
  const body: Record<string, unknown> = { mode: command.mode };
  if (command.mode === "text-notification" && "message" in command) {
    body.message = command.message;
  }
  if (command.mode === "match-start" && "startedAtMs" in command) {
    body.startedAtMs = command.startedAtMs;
  }

  fetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/display/command`,
    {
      body: JSON.stringify(body),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    }
  ).catch(() => {
    // Silently ignore — BroadcastChannel is the same-browser fallback.
  });
};

/**
 * Publish a display command from the control page.
 * Fires over the server API (for cross-device) and BroadcastChannel (for
 * instant same-browser update) in parallel.
 */
export const publishDisplayCommand = (
  eventCode: string,
  command: DisplayCommand,
  token?: string | null
): void => {
  publishLocalCommand(eventCode, command);

  if (token) {
    publishDisplayCommandViaApi(eventCode, command, token);
  }
};

/**
 * Subscribe to display commands for an event via BroadcastChannel/localStorage
 * (same-browser only). Used as a fast local supplement alongside SSE.
 * Returns an unsubscribe function.
 */
export const subscribeToDisplayCommand = (
  eventCode: string,
  onCommand: (command: DisplayCommand) => void
): (() => void) => {
  const dispatchCommand = (payload: DisplayCommandPayload): void => {
    if (payload.eventCode !== eventCode) {
      return;
    }
    let cmd: DisplayCommand;
    if (payload.mode === "text-notification" && "message" in payload) {
      cmd = { mode: "text-notification", message: payload.message ?? "" };
    } else if (payload.mode === "match-start" && "startedAtMs" in payload) {
      cmd = {
        mode: "match-start",
        startedAtMs: (payload as { startedAtMs: number }).startedAtMs,
      };
    } else {
      cmd = { mode: payload.mode };
    }
    onCommand(cmd);
  };

  const handleMessage = (event: MessageEvent<DisplayCommandPayload>): void => {
    const payload = event.data;
    if (payload?.eventCode) {
      dispatchCommand(payload);
    }
  };

  const handleStorage = (e: StorageEvent): void => {
    if (e.key === toStorageKey(eventCode) && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue) as DisplayCommandPayload;
        dispatchCommand(payload);
      } catch {
        // Ignore parse errors
      }
    }
  };

  let channel: BroadcastChannel | null = null;
  try {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.addEventListener("message", handleMessage);
  } catch {
    // BroadcastChannel not available
  }

  window.addEventListener("storage", handleStorage);

  // Initial read from localStorage (same-tab fallback)
  try {
    const stored = localStorage.getItem(toStorageKey(eventCode));
    if (stored) {
      const payload = JSON.parse(stored) as DisplayCommandPayload;
      dispatchCommand(payload);
    }
  } catch {
    // Ignore
  }

  return () => {
    channel?.removeEventListener("message", handleMessage);
    channel?.close();
    window.removeEventListener("storage", handleStorage);
  };
};
