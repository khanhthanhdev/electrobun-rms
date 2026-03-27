import { Hono } from "hono";
import { safeParse } from "valibot";
import { ApplicationError } from "../../application/common/application-error";
import {
  CreateUserAccountUseCase,
  DeleteUserAccountUseCase,
  GetUserWithRolesUseCase,
  ListUsersUseCase,
  UpdateUserAccountUseCase,
} from "../../application/use-cases/users";
import { SQLiteUserRepository } from "../../infrastructure/adapters/users/sqlite-user-repository";
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

export const usersRoutes = new Hono<AppEnv>();
const userRepository = new SQLiteUserRepository();
const listUsersUseCase = new ListUsersUseCase(userRepository);
const getUserWithRolesUseCase = new GetUserWithRolesUseCase(userRepository);
const createUserAccountUseCase = new CreateUserAccountUseCase(userRepository);
const updateUserAccountUseCase = new UpdateUserAccountUseCase(userRepository);
const deleteUserAccountUseCase = new DeleteUserAccountUseCase(userRepository);

const isApplicationError = (error: unknown): error is ApplicationError =>
  error instanceof ApplicationError;

function toUserApplicationErrorResponse(
  c: { json: (payload: unknown, status?: number) => Response },
  error: ApplicationError
): Response {
  if (error.status === 404) {
    return c.json({ error: "Not found", message: error.message }, 404);
  }

  if (error.status === 409) {
    return c.json(
      { error: "User creation failed", message: error.message },
      409
    );
  }

  return c.json({ error: "Validation failed", message: error.message }, 400);
}

usersRoutes.get("/", requireAuth, async (c) => {
  const forbiddenResponse = requireGlobalAdmin(c);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const users = await listUsersUseCase.execute();
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

  const user = await getUserWithRolesUseCase.execute({ username });
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
    const user = await createUserAccountUseCase.execute({
      username: bodyResult.output.username,
      password: bodyResult.output.password,
      roles: bodyResult.output.roles,
    });

    return c.json({ user }, 201);
  } catch (error) {
    if (isApplicationError(error)) {
      return toUserApplicationErrorResponse(c, error);
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
    const user = await updateUserAccountUseCase.execute({
      username,
      password: hasPassword ? bodyResult.output.password : "",
      roles: bodyResult.output.roles,
    });

    return c.json({ user });
  } catch (error) {
    if (isApplicationError(error)) {
      return toUserApplicationErrorResponse(c, error);
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
    await deleteUserAccountUseCase.execute({
      username,
      currentUsername: c.get("auth").sub,
    });

    return c.json({ ok: true });
  } catch (error) {
    if (isApplicationError(error)) {
      return toUserApplicationErrorResponse(c, error);
    }

    throw error;
  }
});
