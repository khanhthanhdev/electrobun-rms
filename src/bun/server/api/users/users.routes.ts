import { Hono } from "hono";
import { safeParse } from "valibot";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireGlobalAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import {
  createUserBodySchema,
  parseUsernameParam,
  updateUserBodySchema,
} from "./users.schema";
import {
  createUserAccount,
  deleteUserAccount,
  getUserWithRoles,
  listUsers,
  UserServiceError,
  updateUserAccount,
} from "./users.service";

export const usersRoutes = new Hono<AppEnv>();

function toUserServiceErrorResponse(
  c: { json: (payload: unknown, status?: number) => Response },
  error: UserServiceError
): Response {
  if (error.status === 404) {
    return c.json({ error: "Not found", message: error.message }, 404);
  }

  return c.json({ error: "Validation failed", message: error.message }, 400);
}

usersRoutes.get("/", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const users = await listUsers();
  return c.json({ users });
});

usersRoutes.get("/:username", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const username = parseUsernameParam(c.req.param("username"));
  if (!username) {
    return c.json(
      {
        error: "Validation failed",
        message: "Invalid username.",
      },
      400
    );
  }

  const user = await getUserWithRoles(username);
  if (!user) {
    return c.json(
      {
        error: "Not found",
        message: `User "${username}" was not found.`,
      },
      404
    );
  }

  return c.json({ user });
});

usersRoutes.post("/", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(createUserBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  if (bodyResult.output.password !== bodyResult.output.passwordConfirm) {
    return c.json(
      {
        error: "Validation failed",
        message: "Password and confirmation password do not match.",
      },
      400
    );
  }

  try {
    const user = await createUserAccount({
      username: bodyResult.output.username,
      password: bodyResult.output.password,
      roles: bodyResult.output.roles,
    });

    return c.json({ user }, 201);
  } catch (error) {
    if (error instanceof UserServiceError) {
      if (error.status === 409) {
        return c.json(
          { error: "User creation failed", message: error.message },
          409
        );
      }

      return toUserServiceErrorResponse(c, error);
    }

    throw error;
  }
});

usersRoutes.put("/:username", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const username = parseUsernameParam(c.req.param("username"));
  if (!username) {
    return c.json(
      {
        error: "Validation failed",
        message: "Invalid username.",
      },
      400
    );
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(updateUserBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  const hasPassword =
    bodyResult.output.password.length > 0 ||
    bodyResult.output.passwordConfirm.length > 0;

  if (
    hasPassword &&
    bodyResult.output.password !== bodyResult.output.passwordConfirm
  ) {
    return c.json(
      {
        error: "Validation failed",
        message: "Password and confirmation password do not match.",
      },
      400
    );
  }

  try {
    const user = await updateUserAccount({
      username,
      password: hasPassword ? bodyResult.output.password : "",
      roles: bodyResult.output.roles,
    });

    return c.json({ user });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return toUserServiceErrorResponse(c, error);
    }

    throw error;
  }
});

usersRoutes.delete("/:username", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const username = parseUsernameParam(c.req.param("username"));
  if (!username) {
    return c.json(
      {
        error: "Validation failed",
        message: "Invalid username.",
      },
      400
    );
  }

  try {
    await deleteUserAccount({
      username,
      currentUsername: c.get("auth").sub,
    });

    return c.json({ ok: true });
  } catch (error) {
    if (error instanceof UserServiceError) {
      return toUserServiceErrorResponse(c, error);
    }

    throw error;
  }
});
