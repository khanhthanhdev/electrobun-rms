import {
  array,
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
 * Union of all 17 documented scene IDs.
 */
export const displaySceneModeSchema = union(
  DISPLAY_SCENE_IDS.map((id) => literal(id))
);

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
});

/**
 * Match reference for display snapshots.
 */
export const displayMatchRefSchema = object({
  matchNumber: number(),
  matchName: string(),
  redTeam: string(),
  redTeamName: optional(string()),
  blueTeam: string(),
  blueTeamName: optional(string()),
});

/**
 * Scene-specific payload for typed scene data.
 * Each scene receives only the shape it needs.
 */
export const displayScenePayloadSchema = object({
  /** Next match scene payload */
  nextMatch: optional(
    object({
      matchNumber: number(),
      matchName: string(),
      redTeam: string(),
      blueTeam: string(),
      startTimeMs: optional(number()),
    })
  ),
  /** Match preview/scene payload */
  match: optional(
    object({
      matchNumber: number(),
      matchName: string(),
      redTeam: string(),
      redTeamName: optional(string()),
      blueTeam: string(),
      blueTeamName: optional(string()),
      redScore: optional(number()),
      blueScore: optional(number()),
    })
  ),
  /** Rankings scene payload */
  rankings: optional(
    object({
      rankings: array(
        object({
          rank: number(),
          teamNumber: string(),
          teamName: optional(string()),
          matchesPlayed: number(),
          points: number(),
        })
      ),
    })
  ),
  /** Inspection scene payload */
  inspection: optional(
    object({
      teams: array(
        object({
          teamNumber: string(),
          teamName: optional(string()),
          status: union([
            literal("NOT_STARTED"),
            literal("IN_PROGRESS"),
            literal("PASSED"),
            literal("READY"),
            literal("INCOMPLETE"),
          ]),
        })
      ),
    })
  ),
  /** Text notification payload */
  message: optional(string()),
});

/**
 * Display session snapshot: authoritative state for rendering.
 * Server publishes this after every intent.
 */
export const displaySessionSnapshotSchema = object({
  /** Event code this snapshot belongs to */
  eventCode: string(),
  /** Schema version for forward compatibility */
  version: number(),
  /** Current scene to render */
  scene: displaySceneModeSchema,
  /** High-level workflow step */
  workflowStep: optional(string()),
  /** User-facing message (for notifications) */
  message: optional(nullable(string())),
  /** Currently loaded match (operator selected) */
  loadedMatch: optional(nullable(displayMatchRefSchema)),
  /** Currently active match (being played) */
  activeMatch: optional(nullable(displayMatchRefSchema)),
  /** Match start timestamp (for timer) */
  startedAtMs: optional(nullable(number())),
  /** Scene-specific typed payload */
  scenePayload: optional(displayScenePayloadSchema),
  /** Last update timestamp */
  updatedAt: string(),
});

/**
 * Stream event: envelope for SSE publishing.
 */
export const displayStreamEventSchema = object({
  /** Event code */
  eventCode: string(),
  /** Event kind: COMMAND_ISSUED or SNAPSHOT_HINT */
  kind: literal("COMMAND_ISSUED", "SNAPSHOT_HINT"),
  /** Changed at timestamp */
  changedAt: string(),
  /** Version number (monotonic) */
  version: number(),
  /** Scene mode */
  mode: nullable(displaySceneModeSchema),
  /** Message */
  message: nullable(string()),
  /** Started at timestamp */
  startedAtMs: nullable(number()),
});
