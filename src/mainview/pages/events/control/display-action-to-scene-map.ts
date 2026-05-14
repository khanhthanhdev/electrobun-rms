/**
 * Maps control page actions to display scene IDs.
 *
 * This ensures the correct scene is shown for each match lifecycle action
 * and prevents inline string duplication across action handlers.
 */

import type { DisplaySceneMode } from "@shared/display";

/** Control actions that trigger display scene changes */
export type DisplayControlAction =
  | "show-preview"
  | "show-match"
  | "start-match"
  | "show-results"
  | "show-blank"
  | "show-ranking"
  | "show-inspection"
  | "show-message"
  | "show-sponsors";

/**
 * Returns the correct display scene ID for a given control action.
 *
 * @param action - The control action being performed
 * @returns The corresponding display scene ID
 *
 * @example
 * getSceneForAction("show-preview") // returns "match-preview"
 * getSceneForAction("show-match") // returns "match-start"
 */
export function getSceneForAction(
  action: DisplayControlAction
): DisplaySceneMode {
  switch (action) {
    case "show-preview":
      return "match-preview";
    case "show-match":
      return "match-start";
    case "start-match":
      return "match-start";
    case "show-results":
      return "match-winner";
    case "show-blank":
      return "blank";
    case "show-ranking":
      return "ranking-result";
    case "show-inspection":
      return "robot-inspection-status";
    case "show-message":
      return "text-notification";
    case "show-sponsors":
      return "sponsors";
    default:
      return "blank";
  }
}
