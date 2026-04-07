import { displayIntentSchema } from "@shared/display";

/**
 * Display command body schema for POST /api/events/:eventCode/display/command
 *
 * @deprecated Use displayIntentSchema from shared contract for new intent-based routes
 */
export const publishDisplayCommandBodySchema = displayIntentSchema;
