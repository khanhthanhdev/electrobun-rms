import {
  literal,
  nullable,
  number,
  object,
  optional,
  string,
  union,
} from "valibot";
import { DISPLAY_SCENE_IDS } from "./display-scene-ids";

/**
 * Valibot schema for display scene mode validation.
 * Union of all documented scene IDs.
 */
export const displaySceneModeSchema = union(
  DISPLAY_SCENE_IDS.map((id) => literal(id))
);

/**
 * Match types that can be shown on the audience display.
 */
export const displayMatchTypeSchema = union([
  literal("practice"),
  literal("quals"),
  literal("elims"),
]);

/**
 * Match reference for display snapshots.
 */
export const displayMatchRefSchema = object({
  matchNumber: number(),
  matchType: displayMatchTypeSchema,
  matchName: string(),
  fieldNumber: number(),
  redTeam: number(),
  redTeamName: optional(string()),
  blueTeam: number(),
  blueTeamName: optional(string()),
});

/**
 * Display intent: command sent from control page to change display state.
 */
export const displayIntentSchema = object({
  /** The scene to display */
  mode: displaySceneModeSchema,
  /** Optional message for text-notification scene */
  message: optional(nullable(string())),
  /** Timestamp when match started (for match-start scene) */
  startedAtMs: optional(nullable(number())),
  /** Currently loaded match selected on the control page */
  loadedMatch: optional(nullable(displayMatchRefSchema)),
  /** Currently active match selected on the control page */
  activeMatch: optional(nullable(displayMatchRefSchema)),
});
