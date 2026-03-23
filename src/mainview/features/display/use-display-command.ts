import { useEffect, useRef, useState } from "react";
import type { DisplayCommand } from "./display-command-channel";
import { subscribeToDisplayCommand } from "./display-command-channel";
import {
  connectDisplayCommandRealtime,
  type ScoreUpdateEvent,
} from "./display-command-sync-service";
import {
  DEFAULT_DISPLAY_SCENE,
  type DisplaySceneMode,
} from "./display-scene-types";
import { applyDisplayRealtimeEvent } from "./state/display-realtime-store";

export interface DisplayCommandState {
  matchStartedAtMs: number | null;
  message: string;
  mode: DisplaySceneMode;
}

const applyCommand = (
  cmd: DisplayCommand,
  setState: React.Dispatch<React.SetStateAction<DisplayCommandState>>
): void => {
  if (cmd.mode === "text-notification" && "message" in cmd) {
    setState({
      mode: "text-notification",
      matchStartedAtMs: null,
      message: cmd.message ?? "",
    });
  } else if (cmd.mode === "match-start" && "startedAtMs" in cmd) {
    setState({
      mode: "match-start",
      matchStartedAtMs: cmd.startedAtMs,
      message: "",
    });
  } else {
    setState({ mode: cmd.mode, matchStartedAtMs: null, message: "" });
  }
};

/**
 * Subscribe to display commands for an event.
 *
 * Dual-channel: SSE (cross-device via server) + BroadcastChannel (same-browser
 * instant fallback). The last command received wins; both channels are deduplicated
 * naturally because they carry the same payload.
 *
 * `token` is optional — SSE stream is public, but passing a token enables
 * the server to filter by auth in the future if needed.
 */
export const useDisplayCommand = (
  eventCode: string,
  token?: string | null
): DisplayCommandState => {
  const [state, setState] = useState<DisplayCommandState>({
    mode: DEFAULT_DISPLAY_SCENE,
    matchStartedAtMs: null,
    message: "",
  });

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // BroadcastChannel + localStorage (same-browser, instant)
  useEffect(() => {
    return subscribeToDisplayCommand(eventCode, (cmd) => {
      applyCommand(cmd, setState);
    });
  }, [eventCode]);

  // SSE (cross-device, via server)
  useEffect(() => {
    const controller = new AbortController();

    connectDisplayCommandRealtime({
      eventCode,
      onCommand: (cmd) => {
        applyCommand(cmd, setState);
      },
      onScoreUpdate: (event: ScoreUpdateEvent) => {
        applyDisplayRealtimeEvent(event);
      },
      onConnectionStateChange: () => {
        // Connection state changes are informational; no UI needed here.
      },
      onError: () => {
        // Errors are handled via reconnection logic inside the service.
      },
      signal: controller.signal,
      token: tokenRef.current ?? null,
    }).catch(() => {
      // Reconnection is handled inside connectDisplayCommandRealtime.
    });

    return () => {
      controller.abort();
    };
  }, [eventCode]);

  return state;
};
