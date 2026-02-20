import { Hono } from "hono";
import { safeParse } from "valibot";
import type { AppEnv } from "../common/app-env";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { requireAuth } from "./auth.middleware";
import { loginBodySchema } from "./auth.schema";
import {
  authenticateUser,
  issueAccessToken,
  recordLogin,
  recordLogout,
} from "./auth.service";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/login", async (c) => {
  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(loginBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  const user = await authenticateUser(bodyResult.output);
  if (!user) {
    return c.json({ error: "Invalid username or password" }, 401);
  }

  const token = await issueAccessToken(user);
  await recordLogin(user);

  return c.json({
    token,
    user: {
      username: user.username,
      type: user.type,
      roles: user.roles,
    },
  });
});

authRoutes.get("/me", requireAuth, (c) => {
  const auth = c.get("auth");
  return c.json({
    user: {
      username: auth.sub,
      type: auth.type,
      roles: auth.roles,
    },
  });
});

authRoutes.post("/logout", requireAuth, async (c) => {
  const auth = c.get("auth");
  await recordLogout(auth.sub);
  return c.json({ ok: true });
});
