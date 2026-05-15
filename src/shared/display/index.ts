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
