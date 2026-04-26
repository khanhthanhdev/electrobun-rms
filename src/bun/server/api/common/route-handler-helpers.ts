import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  type BaseIssue,
  type BaseSchema,
  type InferOutput,
  safeParse,
} from "valibot";
import { ApplicationError } from "../../application/common/application-error";
import type { AppEnv } from "./app-env";
import { parseJsonBody } from "./http";

type RouteHandlerResult<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; response: Response };

type EventCodeGuard = (
  c: Context<AppEnv>,
  eventCode: string
) => Response | null;

export const getEventCodeWithGuard = (
  c: Context<AppEnv>,
  guard: EventCodeGuard
): RouteHandlerResult<string> => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = guard(c, eventCode);
  if (forbiddenResponse) {
    return { ok: false, response: forbiddenResponse };
  }
  return { ok: true, value: eventCode };
};

export const getSeasonEventCodeWithGuard = (
  c: Context<AppEnv>,
  expectedSeason: string,
  guard: EventCodeGuard,
  unsupportedSeasonBody: unknown
): RouteHandlerResult<string> => {
  const { eventCode, season } = c.req.param();
  if (season !== expectedSeason) {
    return { ok: false, response: c.json(unsupportedSeasonBody, 400) };
  }
  const forbiddenResponse = guard(c, eventCode);
  if (forbiddenResponse) {
    return { ok: false, response: forbiddenResponse };
  }
  return { ok: true, value: eventCode };
};

export async function parseJsonBodyOrResponse(
  c: Context,
  invalidJsonBody: unknown,
  status: ContentfulStatusCode
): Promise<RouteHandlerResult<unknown>>;
export async function parseJsonBodyOrResponse<TFallback>(
  c: Context,
  invalidJsonBody: unknown,
  status: ContentfulStatusCode,
  fallbackBody: TFallback
): Promise<RouteHandlerResult<unknown | TFallback>>;
export async function parseJsonBodyOrResponse<TFallback>(
  c: Context,
  invalidJsonBody: unknown,
  status: ContentfulStatusCode,
  fallbackBody?: TFallback
): Promise<RouteHandlerResult<unknown | TFallback>> {
  const body = await parseJsonBody(c);
  if (body === null) {
    if (fallbackBody !== undefined) {
      return { ok: true, value: fallbackBody };
    }
    return { ok: false, response: c.json(invalidJsonBody, status) };
  }
  return { ok: true, value: body };
}

export const safeParseOrResponse = <
  TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
  TErrorBody,
>(
  c: Context,
  schema: TSchema,
  input: unknown,
  invalidBodyFactory: (issues: BaseIssue<unknown>[]) => TErrorBody
): RouteHandlerResult<InferOutput<TSchema>> => {
  const result = safeParse(schema, input);
  if (!result.success) {
    return {
      ok: false,
      response: c.json(invalidBodyFactory(result.issues), 400),
    };
  }
  return { ok: true, value: result.output };
};

export const toApplicationErrorResponse = <TErrorBody>(
  c: Context,
  error: unknown,
  errorBodyFactory: (applicationError: ApplicationError) => TErrorBody
): Response => {
  if (error instanceof ApplicationError) {
    return c.json(
      errorBodyFactory(error),
      error.status as 400 | 401 | 403 | 404 | 409 | 500
    );
  }
  throw error;
};
