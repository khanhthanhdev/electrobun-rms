/**
 * Helpers for control-page match lifecycle state.
 *
 * Provides reference equality, row resolution, and timer math for matches
 * displayed on the event control page. Match refs include `matchType` to
 * uniquely identify matches across schedule types.
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
