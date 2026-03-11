import { displaySceneModeSchema } from "@shared/display";
import { nullable, number, object, optional, string } from "valibot";

/**
 * Display command body schema for POST /api/events/:eventCode/display/command
 *
 * @deprecated Use displayIntentSchema from shared contract for new intent-based routes
 */
export const publishDisplayCommandBodySchema = object({
  message: optional(nullable(string())),
  mode: displaySceneModeSchema,
  startedAtMs: optional(nullable(number())),
});
