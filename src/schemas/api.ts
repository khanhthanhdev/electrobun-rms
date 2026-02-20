import {
  type InferOutput,
  maxLength,
  minLength,
  object,
  parse,
  pipe,
  string,
} from "valibot";

// Login request schema
export const LoginRequestSchema = object({
  username: pipe(string(), minLength(1), maxLength(64)),
  password: pipe(string(), minLength(1), maxLength(128)),
});

export type LoginRequest = InferOutput<typeof LoginRequestSchema>;

// API response schema for errors
export const ApiErrorResponseSchema = object({
  error: string(),
  message: pipe(string(), minLength(0)),
});

export type ApiErrorResponse = InferOutput<typeof ApiErrorResponseSchema>;

export const ApiRequestSchema = LoginRequestSchema;

export function validateApiRequest(data: unknown): LoginRequest {
  return parse(LoginRequestSchema, data);
}
