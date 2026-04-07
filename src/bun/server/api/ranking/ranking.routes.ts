import { Hono } from "hono";
import { ApplicationError } from "../../application/common/application-error";
import {
  GetQualificationRankingsUseCase,
  RebuildQualificationRankingsUseCase,
} from "../../application/use-cases/ranking";
import { SQLiteRankingRepository } from "../../infrastructure/adapters/ranking";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";

export const rankingRoutes = new Hono<AppEnv>();

const rankingRepository = new SQLiteRankingRepository();
const getQualificationRankingsUseCase = new GetQualificationRankingsUseCase(
  rankingRepository
);
const rebuildQualificationRankingsUseCase =
  new RebuildQualificationRankingsUseCase(rankingRepository);

const isApplicationError = (error: unknown): error is ApplicationError =>
  error instanceof ApplicationError;

rankingRoutes.get("/:eventCode/ranking/qualifications", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const result = await getQualificationRankingsUseCase.execute({
      eventCode,
    });
    return c.json(result);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        {
          error: "Failed to load qualification rankings",
          message: error.message,
        },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

rankingRoutes.post(
  "/:eventCode/ranking/qualifications/rebuild",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    try {
      const result = await rebuildQualificationRankingsUseCase.execute({
        eventCode,
      });
      return c.json(result);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to rebuild qualification rankings",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);
