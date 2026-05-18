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
  | { type: "UNLOAD"; expectedVersion: number }
  | { type: "SHOW_PREVIEW"; expectedVersion: number }
  | { type: "SHOW_MATCH"; expectedVersion: number }
  | { type: "START"; expectedVersion: number }
  | { type: "PAUSE"; expectedVersion: number }
  | { type: "RESUME"; expectedVersion: number }
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
//
// CONCURRENCY NOTE: The read-modify-write path in applyTransition is safe
// only because Bun runs on a single event-loop thread and the critical
// section (getState → compute next → set) is fully synchronous with no
// `await`. If this server ever runs multiple workers or processes, the
// state must be moved to a shared store with atomic operations.
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
  activePausedRemainingMs: null,
});

const assertStateInvariants = (
  state: MatchControlState,
  context: string
): void => {
  if (state.loadedState === "IDLE" && state.loadedMatch !== null) {
    throw new Error(
      `Match control invariant failed (${context}): loadedState=IDLE requires loadedMatch=null.`
    );
  }

  if (state.loadedState !== "IDLE" && state.loadedMatch === null) {
    throw new Error(
      `Match control invariant failed (${context}): loadedState=${state.loadedState} requires loadedMatch.`
    );
  }

  if (state.activeState === "IDLE") {
    if (
      state.activeMatch !== null ||
      state.activeStartedAtMs !== null ||
      state.activePausedRemainingMs !== null
    ) {
      throw new Error(
        `Match control invariant failed (${context}): activeState=IDLE requires activeMatch=null, activeStartedAtMs=null, and activePausedRemainingMs=null.`
      );
    }
    return;
  }

  if (state.activeMatch === null) {
    throw new Error(
      `Match control invariant failed (${context}): activeState=${state.activeState} requires activeMatch.`
    );
  }

  if (state.activeStartedAtMs === null) {
    throw new Error(
      `Match control invariant failed (${context}): activeState=${state.activeState} requires activeStartedAtMs.`
    );
  }

  if (
    state.activeState === "PAUSED" &&
    state.activePausedRemainingMs === null
  ) {
    throw new Error(
      `Match control invariant failed (${context}): activeState=PAUSED requires activePausedRemainingMs.`
    );
  }

  if (
    state.activeState !== "PAUSED" &&
    state.activePausedRemainingMs !== null
  ) {
    throw new Error(
      `Match control invariant failed (${context}): activePausedRemainingMs is only valid while activeState=PAUSED.`
    );
  }

  if (state.loadedState !== "IDLE" || state.loadedMatch !== null) {
    throw new Error(
      `Match control invariant failed (${context}): activeState=${state.activeState} requires loadedState=IDLE and loadedMatch=null.`
    );
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const getMatchControlState = (eventCode: string): MatchControlState => {
  const state = stateByEventCode.get(eventCode) ?? defaultState(eventCode);
  assertStateInvariants(state, `read:${eventCode}`);
  return state;
};

export const restoreMatchControlState = (
  eventCode: string,
  state: MatchControlState
): void => {
  assertStateInvariants(state, `restore:${eventCode}`);
  stateByEventCode.set(eventCode, state);
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
  const capturedMatchNumber = state.activeMatch?.matchNumber ?? null;
  const capturedMatchType = state.activeMatch?.matchType ?? null;

  const timer = setTimeout(() => {
    timerByEventCode.delete(eventCode);

    // Verify state hasn't changed since we scheduled this timer
    const current = getMatchControlState(eventCode);
    if (
      current.activeState !== "IN_PROGRESS" ||
      current.activeStartedAtMs !== capturedStartedAtMs ||
      current.activeMatch?.matchNumber !== capturedMatchNumber ||
      current.activeMatch?.matchType !== capturedMatchType
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
type LoadCommand = Extract<MatchControlCommand, { type: "LOAD" }>;

const toInvalidTransitionError = (
  state: MatchControlState,
  message: string
): TransitionError => ({
  currentState: state,
  error: "INVALID_TRANSITION",
  message,
});

const persistTransitionState = (
  eventCode: string,
  next: MatchControlState,
  context: string
): TransitionResult => {
  assertStateInvariants(next, context);
  stateByEventCode.set(eventCode, next);
  return { state: next, version: 0 };
};

const getVersionConflict = (
  state: MatchControlState,
  command: MatchControlCommand,
  currentVersion: number
): TransitionError | null => {
  if (command.type === "AUTO_COMPLETE") {
    return null;
  }

  if (command.expectedVersion === currentVersion) {
    return null;
  }

  return {
    error: "STATE_CONFLICT",
    message: `Expected version ${command.expectedVersion} but current is ${currentVersion}. Refresh state.`,
    currentState: state,
  };
};

const applyLoadTransition = (
  eventCode: string,
  state: MatchControlState,
  command: LoadCommand
): TransitionResult | TransitionError => {
  if (state.activeState !== "IDLE") {
    return toInvalidTransitionError(
      state,
      "Cannot load a match while another is active. Abort or commit first."
    );
  }

  if (state.loadedState !== "IDLE") {
    return toInvalidTransitionError(
      state,
      "A match is already staged. Unload it before loading a new one."
    );
  }

  const next: MatchControlState = {
    ...state,
    version: 0,
    loadedMatch: command.match,
    loadedState: "LOADED",
  };
  return persistTransitionState(eventCode, next, `LOAD:${eventCode}`);
};

const applyUnloadTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.loadedState === "IDLE") {
    return toInvalidTransitionError(state, "No match is loaded to unload.");
  }

  const next: MatchControlState = {
    ...state,
    version: 0,
    loadedMatch: null,
    loadedState: "IDLE",
  };
  return persistTransitionState(eventCode, next, `UNLOAD:${eventCode}`);
};

const applyShowPreviewTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.loadedState !== "LOADED") {
    return toInvalidTransitionError(
      state,
      `Cannot show preview from loadedState "${state.loadedState}".`
    );
  }

  const next: MatchControlState = {
    ...state,
    version: 0,
    loadedState: "PREVIEW",
  };
  return persistTransitionState(eventCode, next, `SHOW_PREVIEW:${eventCode}`);
};

const applyShowMatchTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.loadedState !== "PREVIEW") {
    return toInvalidTransitionError(
      state,
      `Cannot show match from loadedState "${state.loadedState}".`
    );
  }

  const next: MatchControlState = {
    ...state,
    version: 0,
    loadedState: "READY",
  };
  return persistTransitionState(eventCode, next, `SHOW_MATCH:${eventCode}`);
};

const applyStartTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.loadedState !== "READY" || state.activeState !== "IDLE") {
    return toInvalidTransitionError(
      state,
      `Cannot start: loadedState="${state.loadedState}", activeState="${state.activeState}".`
    );
  }

  const next: MatchControlState = {
    ...state,
    version: 0,
    loadedMatch: null,
    loadedState: "IDLE",
    activeMatch: state.loadedMatch,
    activeState: "IN_PROGRESS",
    activeStartedAtMs: Date.now(),
    activePausedRemainingMs: null,
  };
  return persistTransitionState(eventCode, next, `START:${eventCode}`);
};

const applyPauseTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.activeState !== "IN_PROGRESS") {
    return toInvalidTransitionError(
      state,
      `Cannot pause: activeState="${state.activeState}".`
    );
  }

  clearAutoCompleteTimer(eventCode);
  const startedAtMs = state.activeStartedAtMs;
  if (startedAtMs === null) {
    return toInvalidTransitionError(state, "Cannot pause without a start time.");
  }
  const elapsed = Date.now() - startedAtMs;
  const next: MatchControlState = {
    ...state,
    version: 0,
    activeState: "PAUSED",
    activePausedRemainingMs: Math.max(0, MATCH_DURATION_MS - elapsed),
  };
  return persistTransitionState(eventCode, next, `PAUSE:${eventCode}`);
};

const applyResumeTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.activeState !== "PAUSED") {
    return toInvalidTransitionError(
      state,
      `Cannot resume: activeState="${state.activeState}".`
    );
  }

  const remaining = state.activePausedRemainingMs ?? 0;
  const next: MatchControlState = {
    ...state,
    version: 0,
    activeState: "IN_PROGRESS",
    activeStartedAtMs: Date.now() - (MATCH_DURATION_MS - remaining),
    activePausedRemainingMs: null,
  };
  return persistTransitionState(eventCode, next, `RESUME:${eventCode}`);
};

const applyAutoCompleteTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.activeState !== "IN_PROGRESS") {
    return toInvalidTransitionError(
      state,
      `Cannot auto-complete: activeState="${state.activeState}".`
    );
  }

  const next: MatchControlState = {
    ...state,
    version: 0,
    activeState: "COMPLETED",
    activePausedRemainingMs: null,
  };
  return persistTransitionState(eventCode, next, `AUTO_COMPLETE:${eventCode}`);
};

const applyAbortTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.activeState !== "IN_PROGRESS" && state.activeState !== "PAUSED") {
    return toInvalidTransitionError(
      state,
      `Cannot abort: activeState="${state.activeState}".`
    );
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
    activePausedRemainingMs: null,
  };
  return persistTransitionState(eventCode, next, `ABORT:${eventCode}`);
};

const applyCommitTransition = (
  eventCode: string,
  state: MatchControlState
): TransitionResult | TransitionError => {
  if (state.activeState !== "COMPLETED") {
    return toInvalidTransitionError(
      state,
      `Cannot commit: activeState="${state.activeState}".`
    );
  }

  clearAutoCompleteTimer(eventCode);
  const next: MatchControlState = {
    ...state,
    version: 0,
    activeMatch: null,
    activeState: "IDLE",
    activeStartedAtMs: null,
    activePausedRemainingMs: null,
  };
  return persistTransitionState(eventCode, next, `COMMIT:${eventCode}`);
};

export const applyTransition = (
  eventCode: string,
  command: MatchControlCommand,
  currentVersion: number
): TransitionResult | TransitionError => {
  const state = getMatchControlState(eventCode);
  const versionConflict = getVersionConflict(state, command, currentVersion);
  if (versionConflict) {
    return versionConflict;
  }

  switch (command.type) {
    case "LOAD":
      return applyLoadTransition(eventCode, state, command);
    case "UNLOAD":
      return applyUnloadTransition(eventCode, state);
    case "SHOW_PREVIEW":
      return applyShowPreviewTransition(eventCode, state);
    case "SHOW_MATCH":
      return applyShowMatchTransition(eventCode, state);
    case "START":
      return applyStartTransition(eventCode, state);
    case "PAUSE":
      return applyPauseTransition(eventCode, state);
    case "RESUME":
      return applyResumeTransition(eventCode, state);
    case "AUTO_COMPLETE":
      return applyAutoCompleteTransition(eventCode, state);
    case "ABORT":
      return applyAbortTransition(eventCode, state);
    case "COMMIT":
      return applyCommitTransition(eventCode, state);
    default: {
      const exhaustiveCheck: never = command;
      return toInvalidTransitionError(
        state,
        `Unknown transition command: ${exhaustiveCheck}`
      );
    }
  }
};
