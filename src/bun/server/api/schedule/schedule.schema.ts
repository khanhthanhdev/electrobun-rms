import {
  array,
  boolean,
  type InferOutput,
  minLength,
  minValue,
  number,
  object,
  optional,
  pipe,
} from "valibot";

export const scheduleMatchInputSchema = object({
  matchNumber: pipe(number(), minValue(1)),
  redTeam: pipe(number(), minValue(1)),
  blueTeam: pipe(number(), minValue(1)),
  redSurrogate: optional(boolean()),
  blueSurrogate: optional(boolean()),
});

export const savePracticeScheduleBodySchema = object({
  startTime: pipe(number(), minValue(1)),
  cycleTimeSeconds: optional(pipe(number(), minValue(1))),
  matches: array(scheduleMatchInputSchema),
});

export const saveQualificationScheduleBodySchema = object({
  startTime: pipe(number(), minValue(1)),
  cycleTimeSeconds: optional(pipe(number(), minValue(1))),
  fieldCount: optional(pipe(number(), minValue(1))),
  fieldStartOffsetSeconds: optional(pipe(number(), minValue(0))),
  matches: array(scheduleMatchInputSchema),
});

export const matchBlockInputSchema = object({
  startTime: pipe(number(), minValue(1)),
  endTime: pipe(number(), minValue(1)),
  cycleTimeSeconds: pipe(number(), minValue(1)),
});

export const generatePracticeScheduleBodySchema = object({
  matchesPerTeam: pipe(number(), minValue(1)),
  fieldStartOffsetSeconds: optional(pipe(number(), minValue(0))),
  matchBlocks: pipe(array(matchBlockInputSchema), minLength(1)),
});

export const generateQualificationScheduleBodySchema = object({
  startTime: optional(pipe(number(), minValue(1))),
  cycleTimeSeconds: optional(pipe(number(), minValue(1))),
  fieldCount: optional(pipe(number(), minValue(1))),
  fieldStartOffsetSeconds: optional(pipe(number(), minValue(0))),
  matchesPerTeam: optional(pipe(number(), minValue(1))),
});

export const setScheduleActivationBodySchema = object({
  active: boolean(),
});

export type SavePracticeScheduleBody = InferOutput<
  typeof savePracticeScheduleBodySchema
>;
export type GeneratePracticeScheduleBody = InferOutput<
  typeof generatePracticeScheduleBodySchema
>;
export type GenerateQualificationScheduleBody = InferOutput<
  typeof generateQualificationScheduleBodySchema
>;
export type SaveQualificationScheduleBody = InferOutput<
  typeof saveQualificationScheduleBodySchema
>;
export type SetScheduleActivationBody = InferOutput<
  typeof setScheduleActivationBodySchema
>;
