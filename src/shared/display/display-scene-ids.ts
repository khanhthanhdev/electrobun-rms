/**
 * Shared display scene IDs - single source of truth for the entire codebase.
 *
 * These 18 scenes cover all documented display modes in the display control workflow.
 *
 * @see docs/display-control-workflow.md
 */

/**
 * All 18 documented display scene modes.
 *
 * Categories:
 * - Match lifecycle: next-match, match-preview, match-start, match-complete, match-winner
 * - Utility: blank, text-notification
 * - Event info: wifi-reminder, audience-key, safety-security, online-results-info
 * - Content: sponsors, slideshow, video-overlay
 * - Tables/Competition: ranking-result, robot-inspection-status, bracket, alliance-selection
 */
export const DISPLAY_SCENE_IDS = [
  "next-match",
  "match-preview",
  "match-start",
  "match-complete",
  "match-winner",
  "blank",
  "text-notification",
  "wifi-reminder",
  "audience-key",
  "safety-security",
  "online-results-info",
  "sponsors",
  "slideshow",
  "video-overlay",
  "ranking-result",
  "robot-inspection-status",
  "bracket",
  "alliance-selection",
] as const;
