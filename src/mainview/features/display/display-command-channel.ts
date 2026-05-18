/**
 * Command channel for control page -> display page sync.
 *
 * Primary channel: HTTP POST to server SSE hub (cross-device, cross-browser).
 * Fallback channel: BroadcastChannel + localStorage (same-browser, zero-latency).
 *
 * Both channels fire in parallel on publish so the same-browser display
 * updates instantly while cross-device displays update via SSE.
 */

import type { DisplayIntent, DisplayMatchRef } from "@shared/display";

const CHANNEL_NAME = "audience-display-command";
const STORAGE_KEY_PREFIX = "audience-display:";
const API_BASE_URL = "/api" as const;

export type DisplayCommand = DisplayIntent;

export type DisplayCommandPayload = DisplayCommand & { eventCode: string };

interface NormalizableDisplayCommand {
  activeMatch?: unknown;
  loadedMatch?: unknown;
  message?: unknown;
  mode: DisplayCommand["mode"];
  pausedRemainingMs?: unknown;
  startedAtMs?: unknown;
}

const toStorageKey = (eventCode: string): string =>
  `${STORAGE_KEY_PREFIX}${eventCode}`;

const isDisplayMatchType = (
  value: unknown
): value is DisplayMatchRef["matchType"] =>
  value === "practice" || value === "quals" || value === "elims";

const parseDisplayMatchRef = (value: unknown): DisplayMatchRef | null => {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const match = value as Record<string, unknown>;
  const {
    blueTeam,
    blueTeamName,
    fieldNumber,
    matchName,
    matchNumber,
    matchType,
    redTeam,
    redTeamName,
  } = match;

  if (
    typeof matchName !== "string" ||
    !Number.isInteger(matchNumber) ||
    (matchNumber as number) <= 0 ||
    !isDisplayMatchType(matchType) ||
    !Number.isInteger(fieldNumber) ||
    (fieldNumber as number) <= 0 ||
    !Number.isInteger(redTeam) ||
    (redTeam as number) <= 0 ||
    !Number.isInteger(blueTeam) ||
    (blueTeam as number) <= 0
  ) {
    return null;
  }

  return {
    blueTeam: blueTeam as number,
    blueTeamName: typeof blueTeamName === "string" ? blueTeamName : undefined,
    fieldNumber: fieldNumber as number,
    matchName,
    matchNumber: matchNumber as number,
    matchType,
    redTeam: redTeam as number,
    redTeamName: typeof redTeamName === "string" ? redTeamName : undefined,
  };
};

export const normalizeDisplayCommand = (
  command: NormalizableDisplayCommand
): DisplayCommand => ({
  activeMatch: parseDisplayMatchRef(command.activeMatch) ?? null,
  loadedMatch: parseDisplayMatchRef(command.loadedMatch) ?? null,
  message: typeof command.message === "string" ? command.message : null,
  mode: command.mode,
  pausedRemainingMs:
    typeof command.pausedRemainingMs === "number"
      ? command.pausedRemainingMs
      : null,
  startedAtMs:
    typeof command.startedAtMs === "number" ? command.startedAtMs : null,
});

export const createDisplayCommandRequestBody = (
  command: DisplayCommand
): Record<string, unknown> => {
  const normalized = normalizeDisplayCommand(command);
  return {
    activeMatch: normalized.activeMatch,
    loadedMatch: normalized.loadedMatch,
    message: normalized.message,
    mode: normalized.mode,
    pausedRemainingMs: normalized.pausedRemainingMs,
    startedAtMs: normalized.startedAtMs,
  };
};

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
  const payload: DisplayCommandPayload = {
    ...normalizeDisplayCommand(command),
    eventCode,
  };
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
  fetch(
    `${API_BASE_URL}/events/${encodeURIComponent(eventCode)}/display/command`,
    {
      body: JSON.stringify(createDisplayCommandRequestBody(command)),
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
    onCommand(normalizeDisplayCommand(payload));
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
        if (
          typeof payload?.eventCode === "string" &&
          typeof payload?.mode === "string"
        ) {
          dispatchCommand(payload);
        }
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
      if (
        typeof payload?.eventCode === "string" &&
        typeof payload?.mode === "string"
      ) {
        dispatchCommand(payload);
      }
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
