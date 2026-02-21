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
} from "valibot";
import { EVENT_CODE_REGEX, MAX_EVENT_CODE_LENGTH } from "../common/patterns";

export const manualEventBodySchema = object({
  eventCode: pipe(
    string(),
    minLength(1),
    maxLength(MAX_EVENT_CODE_LENGTH),
    regex(EVENT_CODE_REGEX)
  ),
  eventName: pipe(string(), minLength(1), maxLength(256)),
  region: pipe(string(), minLength(1), maxLength(64)),
  eventType: number(),
  startDate: pipe(string(), minLength(1)),
  endDate: pipe(string(), minLength(1)),
  divisions: number(),
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
  finals: optional(number()),
  status: optional(number()),
});

export type UpdateEventBody = InferOutput<typeof updateEventBodySchema>;
