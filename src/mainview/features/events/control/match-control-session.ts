/**
 * Persistence layer for control-page match lifecycle state.
 *
 * Stores loaded/active match refs per event in localStorage so the control
 * page can restore its state after close/reopen. Match refs include
 * `matchType` to uniquely identify matches across schedule types.
 */

import type {
  ControlMatchRow,
  ControlMatchType,
  MatchControlData,
} from "@/shared/types/match-control";

export interface MatchRef {
  matchNumber: number;
  matchType: ControlMatchType;
}

type LoadedMatchState = "idle" | "loaded" | "preview" | "ready";
type ActiveMatchState = "idle" | "in_progress" | "completed";

export interface ControlSession {
  activeMatchRef: MatchRef | null;
  activeStartedAtMs: number | null;
  activeState: ActiveMatchState;
  loadedMatchRef: MatchRef | null;
  loadedState: LoadedMatchState;
}

const STORAGE_KEY_PREFIX = "match-control-session:";

const toStorageKey = (eventCode: string): string =>
  `${STORAGE_KEY_PREFIX}${eventCode}`;

const DEFAULT_SESSION: ControlSession = {
  activeMatchRef: null,
  activeStartedAtMs: null,
  activeState: "idle",
  loadedMatchRef: null,
  loadedState: "idle",
};

const VALID_LOADED_STATES = new Set<LoadedMatchState>([
  "loaded",
  "preview",
  "ready",
]);

const VALID_ACTIVE_STATES = new Set<ActiveMatchState>([
  "in_progress",
  "completed",
]);

const isMatchRef = (value: unknown): value is MatchRef => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.matchNumber === "number" &&
    Number.isInteger(obj.matchNumber) &&
    obj.matchNumber > 0 &&
    (obj.matchType === "practice" || obj.matchType === "quals")
  );
};

export const loadControlSession = (eventCode: string): ControlSession => {
  try {
    const raw = localStorage.getItem(toStorageKey(eventCode));
    if (!raw) {
      return DEFAULT_SESSION;
    }
    const parsed = JSON.parse(raw) as Partial<ControlSession>;
    return {
      activeMatchRef: isMatchRef(parsed.activeMatchRef)
        ? parsed.activeMatchRef
        : null,
      activeStartedAtMs:
        typeof parsed.activeStartedAtMs === "number"
          ? parsed.activeStartedAtMs
          : null,
      activeState: VALID_ACTIVE_STATES.has(
        parsed.activeState as ActiveMatchState
      )
        ? (parsed.activeState as ActiveMatchState)
        : "idle",
      loadedMatchRef: isMatchRef(parsed.loadedMatchRef)
        ? parsed.loadedMatchRef
        : null,
      loadedState: VALID_LOADED_STATES.has(
        parsed.loadedState as LoadedMatchState
      )
        ? (parsed.loadedState as LoadedMatchState)
        : "idle",
    };
  } catch {
    return DEFAULT_SESSION;
  }
};

export const saveControlSession = (
  eventCode: string,
  session: ControlSession
): void => {
  try {
    localStorage.setItem(toStorageKey(eventCode), JSON.stringify(session));
  } catch {
    // localStorage full or unavailable
  }
};

export const toMatchRef = (row: ControlMatchRow): MatchRef => ({
  matchNumber: row.matchNumber,
  matchType: row.matchType,
});

export const matchRefEquals = (
  a: MatchRef | null,
  b: MatchRef | null
): boolean => {
  if (a === b) {
    return true;
  }
  if (!(a && b)) {
    return false;
  }
  return a.matchNumber === b.matchNumber && a.matchType === b.matchType;
};

export const resolveMatchRow = (
  data: MatchControlData | null,
  ref: MatchRef | null
): ControlMatchRow | null => {
  if (!(data && ref)) {
    return null;
  }
  return (
    data.byType[ref.matchType]?.find(
      (row) => row.matchNumber === ref.matchNumber
    ) ?? null
  );
};

export const computeTimeRemaining = (
  startedAtMs: number | null,
  durationSeconds: number
): number => {
  if (!startedAtMs) {
    return durationSeconds;
  }
  const elapsedMs = Date.now() - startedAtMs;
  const elapsed = Math.max(0, Math.floor(elapsedMs / 1000));
  return Math.max(0, durationSeconds - elapsed);
};
