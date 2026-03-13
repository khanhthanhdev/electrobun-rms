import {
  type InferOutput,
  maxLength,
  minLength,
  number,
  object,
  optional,
  pipe,
  regex,
  string,
  transform,
} from "valibot";
import {
  EVENT_CODE_REGEX,
  EVENT_CODE_VALIDATION_MESSAGE,
  normalizeEventCode,
} from "../common/patterns";

export const manualEventBodySchema = object({
  eventCode: pipe(
    string(),
    transform(normalizeEventCode),
    regex(EVENT_CODE_REGEX, EVENT_CODE_VALIDATION_MESSAGE)
  ),
  eventName: pipe(string(), minLength(1), maxLength(256)),
  region: pipe(string(), minLength(1), maxLength(64)),
  eventType: number(),
  startDate: pipe(string(), minLength(1)),
  endDate: pipe(string(), minLength(1)),
  divisions: number(),
  fields: optional(number()),
  finals: optional(number()),
  status: optional(number()),
});

export type ManualEventBody = InferOutput<typeof manualEventBodySchema>;

export const updateEventBodySchema = object({
  eventName: pipe(string(), minLength(1), maxLength(256)),
  region: pipe(string(), minLength(1), maxLength(64)),
  eventType: number(),
  startDate: pipe(string(), minLength(1)),
  endDate: pipe(string(), minLength(1)),
  divisions: number(),
  fields: optional(number()),
  finals: optional(number()),
  status: optional(number()),
});

export type UpdateEventBody = InferOutput<typeof updateEventBodySchema>;
