import type { InferOutput } from "valibot";
import type {
  displayIntentSchema,
  displaySceneModeSchema,
  displayScenePayloadSchema,
  displaySessionSnapshotSchema,
  displayStreamEventSchema,
} from "./display-schemas";

/**
 * Display scene mode: which scene to render.
 */
export type DisplaySceneMode = InferOutput<typeof displaySceneModeSchema>;

/**
 * Display intent: command from control page.
 */
export type DisplayIntent = InferOutput<typeof displayIntentSchema>;

/**
 * Display match reference: loaded or active match.
 */
export type DisplayMatchRef = InferOutput<
  typeof import("./display-schemas").displayMatchRefSchema
>;

/**
 * Display scene payload: typed scene-specific data.
 */
export type DisplayScenePayload = InferOutput<typeof displayScenePayloadSchema>;

/**
 * Display session snapshot: authoritative render state.
 */
export type DisplaySessionSnapshot = InferOutput<
  typeof displaySessionSnapshotSchema
>;

/**
 * Display stream event: SSE envelope.
 */
export type DisplayStreamEvent = InferOutput<typeof displayStreamEventSchema>;
