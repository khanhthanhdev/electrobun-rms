import {
  array,
  type InferOutput,
  maxLength,
  minLength,
  number,
  object,
  picklist,
  pipe,
  regex,
  string,
} from "valibot";
import { schema } from "../../../db";

export const BEARER_REGEX = /^Bearer\s+\S+$/i;
export const BEARER_PREFIX_REGEX = /^Bearer\s+/i;

export const roleAssignmentSchema = object({
  role: picklist(schema.ROLE_VALUES),
  event: pipe(string(), minLength(1), maxLength(64)),
});

export const authTokenSchema = object({
  sub: pipe(string(), minLength(1), maxLength(64)),
  type: number(),
  roles: array(roleAssignmentSchema),
  iat: number(),
  exp: number(),
});

export const loginBodySchema = object({
  username: pipe(string(), minLength(1), maxLength(64)),
  password: pipe(string(), minLength(1), maxLength(128)),
});

export const authHeaderSchema = object({
  authorization: pipe(
    string(),
    regex(BEARER_REGEX, "Authorization must be Bearer token")
  ),
});

export type RoleAssignment = InferOutput<typeof roleAssignmentSchema>;
export type AuthToken = InferOutput<typeof authTokenSchema>;
export type LoginBody = InferOutput<typeof loginBodySchema>;
