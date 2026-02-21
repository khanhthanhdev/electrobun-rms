import { Hono } from "hono";
import { safeParse } from "valibot";
import { ServiceError } from "../../services/manual-event-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { addTeamBodySchema, updateTeamBodySchema } from "./teams.schema";
import { createTeam, editTeam, listTeams, removeTeam } from "./teams.service";

export const teamsRoutes = new Hono<AppEnv>();

const parseTeamNumberParam = (
  value: string
): { teamNumber: number } | { error: string } => {
  const parsedTeamNumber = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedTeamNumber) || parsedTeamNumber <= 0) {
    return { error: "Team number must be a positive whole number." };
  }

  return { teamNumber: parsedTeamNumber };
};

teamsRoutes.get("/:eventCode/teams", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }
  const search = c.req.query("search");

  try {
    const teams = listTeams(eventCode, search);
    return c.json(teams);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to load teams", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

teamsRoutes.post("/:eventCode/teams", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(addTeamBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  try {
    const team = createTeam(eventCode, bodyResult.output);
    return c.json({ team }, 201);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to add team", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

teamsRoutes.put("/:eventCode/teams/:teamNumber", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
  if ("error" in teamNumberResult) {
    return c.json(
      { error: "Validation failed", message: teamNumberResult.error },
      400
    );
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(updateTeamBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  try {
    const team = editTeam(
      eventCode,
      teamNumberResult.teamNumber,
      bodyResult.output
    );
    return c.json({ team });
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to edit team", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

teamsRoutes.delete("/:eventCode/teams/:teamNumber", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const teamNumberResult = parseTeamNumberParam(c.req.param("teamNumber"));
  if ("error" in teamNumberResult) {
    return c.json(
      { error: "Validation failed", message: teamNumberResult.error },
      400
    );
  }

  try {
    removeTeam(eventCode, teamNumberResult.teamNumber);
    return c.json({ deletedTeamNumber: teamNumberResult.teamNumber });
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to delete team", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});
