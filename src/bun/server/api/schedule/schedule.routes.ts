import { Hono } from "hono";
import { safeParse } from "valibot";
import { ServiceError } from "../../services/manual-event-service";
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
import {
  deletePracticeSchedule,
  deleteQualificationSchedule,
  editPracticeSchedule,
  editQualificationSchedule,
  listPracticeSchedule,
  listQualificationSchedule,
  regeneratePracticeSchedule,
  regenerateQualificationSchedule,
  updatePracticeScheduleActivation,
  updateQualificationScheduleActivation,
} from "./schedule.service";

export const scheduleRoutes = new Hono<AppEnv>();

scheduleRoutes.get("/:eventCode/schedule/practice", (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const schedule = listPracticeSchedule(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (error instanceof ServiceError) {
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
    const schedule = editPracticeSchedule(eventCode, bodyResult.output);
    return c.json(schedule);
  } catch (error) {
    if (error instanceof ServiceError) {
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
      const schedule = regeneratePracticeSchedule(eventCode, bodyResult.output);
      return c.json(schedule, 201);
    } catch (error) {
      if (error instanceof ServiceError) {
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

scheduleRoutes.delete("/:eventCode/schedule/practice", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    const schedule = deletePracticeSchedule(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to clear practice schedule", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scheduleRoutes.get("/:eventCode/schedule/quals", (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const schedule = listQualificationSchedule(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (error instanceof ServiceError) {
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
    const schedule = editQualificationSchedule(eventCode, bodyResult.output);
    return c.json(schedule);
  } catch (error) {
    if (error instanceof ServiceError) {
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
      const schedule = regenerateQualificationSchedule(
        eventCode,
        bodyResult.output
      );
      return c.json(schedule, 201);
    } catch (error) {
      if (error instanceof ServiceError) {
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

scheduleRoutes.delete("/:eventCode/schedule/quals", requireAuth, (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  try {
    const schedule = deleteQualificationSchedule(eventCode);
    return c.json(schedule);
  } catch (error) {
    if (error instanceof ServiceError) {
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
      const schedule = updatePracticeScheduleActivation(
        eventCode,
        bodyResult.output.active
      );
      return c.json(schedule);
    } catch (error) {
      if (error instanceof ServiceError) {
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
      const schedule = updateQualificationScheduleActivation(
        eventCode,
        bodyResult.output.active
      );
      return c.json(schedule);
    } catch (error) {
      if (error instanceof ServiceError) {
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
