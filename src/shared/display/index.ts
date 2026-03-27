/**
 * Shared display contract - single source of truth.
 *
 * This module exports:
 * - All 17 display scene IDs
 * - Valibot schemas for validation
 * - TypeScript types for type safety
 *
 * @see docs/display-control-workflow.md
 */

export {
  DISPLAY_SCENE_IDS,
  type DisplaySceneId,
  isValidDisplaySceneId,
} from "./display-scene-ids";

// Schemas
export {
  displayIntentSchema,
  displayMatchRefSchema,
  displaySceneModeSchema,
  displayScenePayloadSchema,
  displaySessionSnapshotSchema,
  displayStreamEventSchema,
} from "./display-schemas";

// Types
export type {
  DisplayIntent,
  DisplayMatchRef,
  DisplaySceneMode,
  DisplayScenePayload,
  DisplaySessionSnapshot,
  DisplayStreamEvent,
} from "./display-types";
