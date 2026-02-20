import {
  array,
  type InferOutput,
  maxLength,
  minLength,
  object,
  picklist,
  pipe,
  regex,
  string,
} from "valibot";
import { schema } from "../../../db";
import { MAX_EVENT_CODE_LENGTH, USERNAME_REGEX } from "../common/patterns";

const EVENT_SCOPE_REGEX = /^(\*|[a-z0-9_]+)$/;

export const createUserRoleSchema = object({
  role: picklist(schema.ROLE_VALUES),
  event: pipe(
    string(),
    minLength(1),
    maxLength(MAX_EVENT_CODE_LENGTH),
    regex(EVENT_SCOPE_REGEX)
  ),
});

export const createUserBodySchema = object({
  username: pipe(string(), minLength(1), maxLength(64), regex(USERNAME_REGEX)),
  password: pipe(string(), minLength(1), maxLength(128)),
  passwordConfirm: pipe(string(), minLength(1), maxLength(128)),
  roles: array(createUserRoleSchema),
});

export const updateUserBodySchema = object({
  password: pipe(string(), minLength(1), maxLength(128)),
  passwordConfirm: pipe(string(), minLength(1), maxLength(128)),
  roles: array(createUserRoleSchema),
});

export type CreateUserBody = InferOutput<typeof createUserBodySchema>;
export type CreateUserRole = InferOutput<typeof createUserRoleSchema>;
export type UpdateUserBody = InferOutput<typeof updateUserBodySchema>;

export function parseUsernameParam(username: string): string | null {
  return USERNAME_REGEX.test(username) ? username : null;
}
