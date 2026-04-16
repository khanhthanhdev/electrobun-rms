import { Hono } from "hono";
import { safeParse } from "valibot";
import { ApplicationError } from "../../application/common/application-error";
import {
  ActivateScheduleUseCase,
  ClearQualificationScheduleUseCase,
  CreatePracticeMatchUseCase,
  DeletePracticeMatchUseCase,
  GeneratePracticeScheduleUseCase,
  GenerateQualificationScheduleUseCase,
  ListPracticeMatchesUseCase,
  ListQualificationMatchesUseCase,
  SaveQualificationScheduleUseCase,
} from "../../application/use-cases/schedule";
import { SQLiteScheduleRepository } from "../../infrastructure/adapters/schedule/sqlite-schedule-repository";
import { outboundSyncPushService } from "../../infrastructure/services/outbound-sync-push-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import {
  generatePracticeScheduleBodySchema,
  generateQualificationScheduleBodySchema,
  savePracticeScheduleBodySchema,
  saveQualificationScheduleBodySchema,
  setScheduleActivationBodySchema,
} from "./schedule.schema";

export const scheduleRoutes = new Hono<AppEnv>();

const scheduleRepository = new SQLiteScheduleRepository();
const listPracticeMatchesUseCase = new ListPracticeMatchesUseCase(
  scheduleRepository
);
const createPracticeMatchUseCase = new CreatePracticeMatchUseCase(
  scheduleRepository
);
const generatePracticeScheduleUseCase = new GeneratePracticeScheduleUseCase(
  scheduleRepository
);
const deletePracticeMatchUseCase = new DeletePracticeMatchUseCase(
  scheduleRepository
);
const listQualificationMatchesUseCase = new ListQualificationMatchesUseCase(
  scheduleRepository
);
const saveQualificationScheduleUseCase = new SaveQualificationScheduleUseCase(
  scheduleRepository
);
const generateQualificationScheduleUseCase =
  new GenerateQualificationScheduleUseCase(scheduleRepository);
const clearQualificationScheduleUseCase = new ClearQualificationScheduleUseCase(
  scheduleRepository
);
const activateScheduleUseCase = new ActivateScheduleUseCase(scheduleRepository);

const isApplicationError = (error: unknown): error is ApplicationError =>
  error instanceof ApplicationError;

scheduleRoutes.get("/:eventCode/schedule/practice", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const schedule = await listPracticeMatchesUseCase.execute({ eventCode });
    return c.json(schedule);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        { error: "Failed to load practice schedule", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scheduleRoutes.put("/:eventCode/schedule/practice", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(savePracticeScheduleBodySchema, body);
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
    const schedule = await createPracticeMatchUseCase.execute({
      eventCode,
      payload: bodyResult.output,
    });
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        { error: "Failed to save practice schedule", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scheduleRoutes.post(
  "/:eventCode/schedule/practice/generate",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(generatePracticeScheduleBodySchema, body);
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
      const schedule = await generatePracticeScheduleUseCase.execute({
        eventCode,
        payload: bodyResult.output,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule, 201);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to generate practice schedule",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

scheduleRoutes.delete(
  "/:eventCode/schedule/practice",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    try {
      const schedule = await deletePracticeMatchUseCase.execute({ eventCode });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to clear practice schedule",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

scheduleRoutes.get("/:eventCode/schedule/quals", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const schedule = await listQualificationMatchesUseCase.execute({
      eventCode,
    });
    return c.json(schedule);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        {
          error: "Failed to load qualification schedule",
          message: error.message,
        },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scheduleRoutes.put("/:eventCode/schedule/quals", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(saveQualificationScheduleBodySchema, body);
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
    const schedule = await saveQualificationScheduleUseCase.execute({
      eventCode,
      payload: bodyResult.output,
    });
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        {
          error: "Failed to save qualification schedule",
          message: error.message,
        },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scheduleRoutes.post(
  "/:eventCode/schedule/quals/generate",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const body = (await parseJsonBody(c)) ?? {};

    const bodyResult = safeParse(generateQualificationScheduleBodySchema, body);
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
      const schedule = await generateQualificationScheduleUseCase.execute({
        eventCode,
        payload: bodyResult.output,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule, 201);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to generate qualification schedule",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

scheduleRoutes.delete("/:eventCode/schedule/quals", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    const schedule = await clearQualificationScheduleUseCase.execute({
      eventCode,
    });
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (isApplicationError(error)) {
      return c.json(
        {
          error: "Failed to clear qualification schedule",
          message: error.message,
        },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scheduleRoutes.put(
  "/:eventCode/schedule/practice/active",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(setScheduleActivationBodySchema, body);
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
      const schedule = await activateScheduleUseCase.execute({
        eventCode,
        scheduleType: "practice",
        active: bodyResult.output.active,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to update practice schedule activation",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

scheduleRoutes.put(
  "/:eventCode/schedule/quals/active",
  requireAuth,
  async (c) => {
    const eventCode = c.req.param("eventCode");
    const forbiddenResponse = requireEventAdmin(c, eventCode);
    if (forbiddenResponse) {
      return forbiddenResponse;
    }

    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json({ error: "Body must be valid JSON" }, 400);
    }

    const bodyResult = safeParse(setScheduleActivationBodySchema, body);
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
      const schedule = await activateScheduleUseCase.execute({
        eventCode,
        scheduleType: "quals",
        active: bodyResult.output.active,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule);
    } catch (error) {
      if (isApplicationError(error)) {
        return c.json(
          {
            error: "Failed to update qualification schedule activation",
            message: error.message,
          },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);
