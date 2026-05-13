import { literal, nullable, number, object, string, union } from "valibot";
import { displayMatchRefSchema } from "../display/display-schemas";

/** Default match duration in seconds (shared between server and client). */
export const MATCH_DURATION_SECONDS = 480;

/**
 * Loaded slot states.
 */
export const loadedStateSchema = union([
  literal("IDLE"),
  literal("LOADED"),
  literal("PREVIEW"),
  literal("READY"),
]);

/**
 * Active slot states.
 */
export const activeStateSchema = union([
  literal("IDLE"),
  literal("IN_PROGRESS"),
  literal("COMPLETED"),
]);

/**
 * Server-side match control state snapshot.
 */
export const matchControlStateSchema = object({
  eventCode: string(),
  version: number(),
  loadedMatch: nullable(displayMatchRefSchema),
  loadedState: loadedStateSchema,
  activeMatch: nullable(displayMatchRefSchema),
  activeState: activeStateSchema,
  activeStartedAtMs: nullable(number()),
});

/**
 * Body for POST /match-control/load
 */
export const matchControlLoadBodySchema = object({
  match: displayMatchRefSchema,
  expectedVersion: number(),
});

/**
 * Body for all other match-control transition routes.
 */
export const matchControlTransitionBodySchema = object({
  expectedVersion: number(),
});
