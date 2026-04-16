import type { DisplayMatchRef } from "@shared/display";
import {
  MATCH_DURATION_SECONDS,
  type MatchControlState,
} from "@shared/match-control";

// ---------------------------------------------------------------------------
// Command types
// ---------------------------------------------------------------------------

export type MatchControlCommand =
  | { type: "LOAD"; match: DisplayMatchRef; expectedVersion: number }
  | { type: "SHOW_PREVIEW"; expectedVersion: number }
  | { type: "SHOW_MATCH"; expectedVersion: number }
  | { type: "START"; expectedVersion: number }
  | { type: "AUTO_COMPLETE" }
  | { type: "ABORT"; expectedVersion: number }
  | { type: "COMMIT"; expectedVersion: number };

// ---------------------------------------------------------------------------
// Transition result
// ---------------------------------------------------------------------------

export interface TransitionResult {
  state: MatchControlState;
  version: number;
}

export interface TransitionError {
  currentState: MatchControlState;
  error: "STATE_CONFLICT" | "INVALID_TRANSITION";
  message: string;
}

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

const stateByEventCode = new Map<string, MatchControlState>();
const timerByEventCode = new Map<string, Timer>();

const MATCH_DURATION_MS = MATCH_DURATION_SECONDS * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultState = (eventCode: string): MatchControlState => ({
  eventCode,
  version: 0,
  loadedMatch: null,
  loadedState: "IDLE",
  activeMatch: null,
  activeState: "IDLE",
  activeStartedAtMs: null,
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getMatchControlState = (eventCode: string): MatchControlState => {
  return stateByEventCode.get(eventCode) ?? defaultState(eventCode);
};

/**
 * Schedule the auto-complete timer for a running match.
 * The callback receives the resulting state after AUTO_COMPLETE.
 *
 * `getCurrentVersion` is provided by the caller so that version management
 * stays in the sync hub layer.
 */
export const scheduleAutoComplete = (
  eventCode: string,
  getCurrentVersion: () => number,
  onComplete: (result: TransitionResult) => void
): void => {
  clearAutoCompleteTimer(eventCode);

  const state = getMatchControlState(eventCode);
  if (state.activeState !== "IN_PROGRESS" || !state.activeStartedAtMs) {
    return;
  }

  const elapsed = Date.now() - state.activeStartedAtMs;
  const remaining = Math.max(0, MATCH_DURATION_MS - elapsed);

  const capturedStartedAtMs = state.activeStartedAtMs;
  const capturedMatch = state.activeMatch;

  const timer = setTimeout(() => {
    timerByEventCode.delete(eventCode);

    // Verify state hasn't changed since we scheduled this timer
    const current = getMatchControlState(eventCode);
    if (
      current.activeState !== "IN_PROGRESS" ||
      current.activeStartedAtMs !== capturedStartedAtMs ||
      current.activeMatch !== capturedMatch
    ) {
      return;
    }

    const result = applyTransition(
      eventCode,
      { type: "AUTO_COMPLETE" },
      getCurrentVersion()
    );
    if ("state" in result) {
      onComplete(result);
    }
  }, remaining);

  timerByEventCode.set(eventCode, timer);
};

export const clearAutoCompleteTimer = (eventCode: string): void => {
  const existing = timerByEventCode.get(eventCode);
  if (existing) {
    clearTimeout(existing);
    timerByEventCode.delete(eventCode);
  }
};

/**
 * Apply a state transition command. Returns the new state or an error.
 *
 * `currentVersion` must be provided by the caller (from the sync hub) so that
 * version validation and SSE publishing use a single version counter.
 * The returned `state.version` is a placeholder (0); the real version is
 * assigned by the sync hub when the event is published.
 */
export const applyTransition = (
  eventCode: string,
  command: MatchControlCommand,
  currentVersion: number
): TransitionResult | TransitionError => {
  const state = getMatchControlState(eventCode);

  // Version check for client-initiated commands
  if (
    command.type !== "AUTO_COMPLETE" &&
    command.expectedVersion !== currentVersion
  ) {
    return {
      error: "STATE_CONFLICT",
      message: `Expected version ${command.expectedVersion} but current is ${currentVersion}. Refresh state.`,
      currentState: state,
    };
  }

  switch (command.type) {
    case "LOAD": {
      if (state.activeState !== "IDLE") {
        return {
          error: "INVALID_TRANSITION",
          message: "Cannot load a match while another is active.",
          currentState: state,
        };
      }
      const next: MatchControlState = {
        ...state,
        version: 0,
        loadedMatch: command.match,
        loadedState: "LOADED",
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    case "SHOW_PREVIEW": {
      if (state.loadedState !== "LOADED") {
        return {
          error: "INVALID_TRANSITION",
          message: `Cannot show preview from loadedState "${state.loadedState}".`,
          currentState: state,
        };
      }
      const next: MatchControlState = {
        ...state,
        version: 0,
        loadedState: "PREVIEW",
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    case "SHOW_MATCH": {
      if (state.loadedState !== "PREVIEW") {
        return {
          error: "INVALID_TRANSITION",
          message: `Cannot show match from loadedState "${state.loadedState}".`,
          currentState: state,
        };
      }
      const next: MatchControlState = {
        ...state,
        version: 0,
        loadedState: "READY",
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    case "START": {
      if (state.loadedState !== "READY" || state.activeState !== "IDLE") {
        return {
          error: "INVALID_TRANSITION",
          message: `Cannot start: loadedState="${state.loadedState}", activeState="${state.activeState}".`,
          currentState: state,
        };
      }
      const next: MatchControlState = {
        ...state,
        version: 0,
        loadedMatch: null,
        loadedState: "IDLE",
        activeMatch: state.loadedMatch,
        activeState: "IN_PROGRESS",
        activeStartedAtMs: Date.now(),
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    case "AUTO_COMPLETE": {
      if (state.activeState !== "IN_PROGRESS") {
        return {
          error: "INVALID_TRANSITION",
          message: `Cannot auto-complete: activeState="${state.activeState}".`,
          currentState: state,
        };
      }
      const next: MatchControlState = {
        ...state,
        version: 0,
        activeState: "COMPLETED",
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    case "ABORT": {
      if (state.activeState !== "IN_PROGRESS") {
        return {
          error: "INVALID_TRANSITION",
          message: `Cannot abort: activeState="${state.activeState}".`,
          currentState: state,
        };
      }
      clearAutoCompleteTimer(eventCode);
      const next: MatchControlState = {
        ...state,
        version: 0,
        loadedMatch: state.activeMatch,
        loadedState: "LOADED",
        activeMatch: null,
        activeState: "IDLE",
        activeStartedAtMs: null,
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    case "COMMIT": {
      if (state.activeState !== "COMPLETED") {
        return {
          error: "INVALID_TRANSITION",
          message: `Cannot commit: activeState="${state.activeState}".`,
          currentState: state,
        };
      }
      clearAutoCompleteTimer(eventCode);
      const next: MatchControlState = {
        ...state,
        version: 0,
        activeMatch: null,
        activeState: "IDLE",
        activeStartedAtMs: null,
      };
      stateByEventCode.set(eventCode, next);
      return { state: next, version: 0 };
    }

    default: {
      const exhaustiveCheck: never = command;
      return {
        error: "INVALID_TRANSITION",
        message: `Unknown transition command: ${exhaustiveCheck}`,
        currentState: state,
      };
    }
  }
};
