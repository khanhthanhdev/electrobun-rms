import type { DisplayMatchRef } from "@shared/display";
import type { MatchControlState } from "@shared/match-control";
import type { MatchControlCommand } from "../match-control/match-control-state";
import { displaySyncHub } from "./display-sync";

interface DisplayBridgeContext {
  /** Pre-transition active match, needed for COMMIT where state already cleared it. */
  committedMatch?: DisplayMatchRef | null;
}

/**
 * Bridge that translates match-control state transitions into display sync
 * events. This keeps Display domain knowledge (scene modes) inside the
 * display module instead of leaking it into match-control routes.
 */
export const publishDisplayFromMatchControl = (
  state: MatchControlState,
  trigger: MatchControlCommand["type"],
  _context?: DisplayBridgeContext
): void => {
  const latest = displaySyncHub.getLatestEvent(state.eventCode);

  switch (trigger) {
    case "LOAD":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: latest?.mode ?? "blank",
        loadedMatch: state.loadedMatch,
        activeMatch: state.activeMatch,
        message: latest?.message ?? null,
        startedAtMs: latest?.startedAtMs ?? null,
      });
      break;

    case "UNLOAD":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: "blank",
        loadedMatch: null,
        activeMatch: null,
        message: latest?.message ?? null,
        startedAtMs: null,
      });
      break;

    case "SHOW_PREVIEW":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: "match-preview",
        loadedMatch: state.loadedMatch,
        activeMatch: null,
      });
      break;

    case "SHOW_MATCH":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: "match-start",
        loadedMatch: state.loadedMatch,
        activeMatch: null,
        startedAtMs: null,
      });
      break;

    case "START":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: "match-start",
        loadedMatch: null,
        activeMatch: state.activeMatch,
        startedAtMs: state.activeStartedAtMs,
      });
      break;

    case "AUTO_COMPLETE":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: "match-complete",
        loadedMatch: null,
        activeMatch: state.activeMatch,
        startedAtMs: state.activeStartedAtMs,
      });
      break;

    case "ABORT":
      displaySyncHub.publish({
        eventCode: state.eventCode,
        kind: "COMMAND_ISSUED",
        mode: "blank",
        loadedMatch: state.loadedMatch,
        activeMatch: null,
        startedAtMs: null,
      });
      break;

    case "COMMIT":
      // Intentional: posting committed scores to the display is a separate
      // operator action handled by /show-results.
      break;

    default:
      return;
  }
};
