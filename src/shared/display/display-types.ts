import type { InferOutput } from "valibot";
import type {
  displayIntentSchema,
  displaySceneModeSchema,
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
