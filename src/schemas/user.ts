import { vValidator } from "@hono/valibot-validator";
import {
  email,
  type InferOutput,
  maxLength,
  minLength,
  object,
  parse,
  pipe,
  string,
} from "valibot";

// User schema
export const UserSchema = object({
  id: string(),
  email: pipe(
    string(),
    minLength(1, "Email is required"),
    email("Invalid email format")
  ),
  name: pipe(
    string(),
    minLength(1, "Name is required"),
    maxLength(100, "Name must be less than 100 characters")
  ),
  createdAt: string(),
});

export type User = InferOutput<typeof UserSchema>;

export function validateUser(data: unknown): User {
  return parse(UserSchema, data);
}

// Hono validator middleware for User schema
export const validateUserBody = vValidator("json", UserSchema);
export const validateUserQuery = vValidator("query", UserSchema);
export const validateUserParam = vValidator("param", UserSchema);
