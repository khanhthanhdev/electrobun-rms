import type { Context, Next } from "hono";
import { verify } from "hono/jwt";
import { safeParse } from "valibot";
import {
  authHeaderSchema,
  authTokenSchema,
  BEARER_PREFIX_REGEX,
} from "./auth.schema";
import { getJwtSecret } from "./auth.service";

export async function requireAuth(
  c: Context,
  next: Next
): Promise<Response | undefined> {
  const authorization = c.req.header("authorization");
  const headerResult = safeParse(authHeaderSchema, { authorization });
  if (!headerResult.success) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = headerResult.output.authorization.replace(
    BEARER_PREFIX_REGEX,
    ""
  );
  const secret = await getJwtSecret();

  let payload: unknown;
  try {
    payload = await verify(token, secret, "HS256");
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }

  const parsedPayload = safeParse(authTokenSchema, payload);
  if (!parsedPayload.success) {
    return c.json({ error: "Invalid token payload" }, 401);
  }

  c.set("auth", parsedPayload.output);
  await next();
}
