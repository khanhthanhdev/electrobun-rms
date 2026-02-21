import {
  type InferOutput,
  maxLength,
  minLength,
  number,
  object,
  optional,
  pipe,
  string,
} from "valibot";

export const addTeamBodySchema = object({
  teamNumber: number(),
  teamName: pipe(string(), minLength(1), maxLength(128)),
  organizationSchool: optional(pipe(string(), maxLength(128))),
  city: optional(pipe(string(), maxLength(64))),
  country: optional(pipe(string(), maxLength(64))),
});

export const updateTeamBodySchema = object({
  teamName: pipe(string(), minLength(1), maxLength(128)),
  organizationSchool: optional(pipe(string(), maxLength(128))),
  city: optional(pipe(string(), maxLength(64))),
  country: optional(pipe(string(), maxLength(64))),
});

export type AddTeamBody = InferOutput<typeof addTeamBodySchema>;
export type UpdateTeamBody = InferOutput<typeof updateTeamBodySchema>;
