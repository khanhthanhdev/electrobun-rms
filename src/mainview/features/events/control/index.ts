/**
 * Control subfeature public API.
 */

export { useMatchControlRealtime } from "./hooks/use-match-control-realtime";
export {
  fetchMatchControlState,
  MatchControlTransitionError,
  postMatchControlLoad,
  postMatchControlTransition,
} from "./match-control-api";
export { fetchMatchControlData } from "./match-control-service";
export type { MatchRef } from "./match-control-session";
export {
  computeTimeRemaining,
  matchRefEquals,
  resolveMatchRow,
  toMatchRef,
} from "./match-control-session";
export {
  getMatchControlRealtimeState,
  subscribeToMatchControlRealtimeState,
} from "./state/match-control-sync-store";
export { useMatchControlData } from "./use-match-control-data";
