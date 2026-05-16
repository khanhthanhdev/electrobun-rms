/**
 * Shared display contract - single source of truth.
 *
 * This module exports:
 * - All 18 display scene IDs
 * - Valibot schemas for validation
 * - TypeScript types for type safety
 *
 * @see docs/display-control-workflow.md
 */

// Schemas
export { displayIntentSchema } from "./display-schemas";

// Types
export type {
  DisplayIntent,
  DisplayMatchRef,
  DisplaySceneMode,
} from "./display-types";
export {
  DEFAULT_DISPLAY_FOOTER_COLOR,
  DEFAULT_DISPLAY_FOOTER_TEXT,
  DEFAULT_DISPLAY_HEADER_COLOR,
  DEFAULT_DISPLAY_TEXT_SETTINGS,
  DISPLAY_CUSTOM_HEADER_MAX_LENGTH,
  DISPLAY_FOOTER_FONT_SIZE_MAX,
  DISPLAY_FOOTER_FONT_SIZE_MIN,
  DISPLAY_FOOTER_MAX_LENGTH,
  DISPLAY_HEADER_FONT_SIZE_MAX,
  DISPLAY_HEADER_FONT_SIZE_MIN,
} from "./display-text-settings";
export type {
  DisplayHeaderMode,
  DisplayTextSettings,
} from "./display-text-settings";
