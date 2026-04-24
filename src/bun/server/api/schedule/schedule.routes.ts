import { Hono } from "hono";
import type { Context } from "hono";
import type { BaseIssue, BaseSchema, InferOutput } from "valibot";
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
import {
  getEventCodeWithGuard,
  parseJsonBodyOrResponse,
  safeParseOrResponse,
  toApplicationErrorResponse,
} from "../common/route-handler-helpers";
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

const INVALID_JSON_BODY = { error: "Body must be valid JSON" } as const;

const getScheduleWriteEventCode = (c: Context<AppEnv>) =>
  getEventCodeWithGuard(c, requireEventAdmin);

const parseScheduleBodyOrResponse = (c: Context) =>
  parseJsonBodyOrResponse(c, INVALID_JSON_BODY, 400);

const parseScheduleBodyWithFallbackOrResponse = (
  c: Context,
  fallbackBody: Record<string, never>
) => parseJsonBodyOrResponse(c, INVALID_JSON_BODY, 400, fallbackBody);

const safeParseScheduleBodyOrResponse = <
  TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(
  c: Context,
  schema: TSchema,
  input: unknown
) =>
  safeParseOrResponse(c, schema, input, (issues) => ({
    error: "Validation failed",
    message: formatValidationIssues(issues),
  }));

const getScheduleMutationInput = async <
  TSchema extends BaseSchema<unknown, unknown, BaseIssue<unknown>>,
>(
  c: Context<AppEnv>,
  schema: TSchema,
  fallbackBody?: Record<string, never>
): Promise<
  | {
      ok: true;
      value: {
        eventCode: string;
        payload: InferOutput<TSchema>;
      };
    }
  | { ok: false; response: Response }
> => {
  const eventCodeResult = getScheduleWriteEventCode(c);
  if (!eventCodeResult.ok) {
    return eventCodeResult;
  }

  const bodyResult =
    fallbackBody === undefined
      ? await parseScheduleBodyOrResponse(c)
      : await parseScheduleBodyWithFallbackOrResponse(c, fallbackBody);
  if (!bodyResult.ok) {
    return bodyResult;
  }

  const parsedBodyResult = safeParseScheduleBodyOrResponse(
    c,
    schema,
    bodyResult.value
  );
  if (!parsedBodyResult.ok) {
    return parsedBodyResult;
  }

  return {
    ok: true,
    value: {
      eventCode: eventCodeResult.value,
      payload: parsedBodyResult.value,
    },
  };
};

scheduleRoutes.get("/:eventCode/schedule/practice", async (c) => {
  const eventCode = c.req.param("eventCode");

  try {
    const schedule = await listPracticeMatchesUseCase.execute({ eventCode });
    return c.json(schedule);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to load practice schedule",
      message: applicationError.message,
    }));
  }
});

scheduleRoutes.put("/:eventCode/schedule/practice", requireAuth, async (c) => {
  const mutationInputResult = await getScheduleMutationInput(
    c,
    savePracticeScheduleBodySchema
  );
  if (!mutationInputResult.ok) {
    return mutationInputResult.response;
  }
  const { eventCode, payload } = mutationInputResult.value;

  try {
    const schedule = await createPracticeMatchUseCase.execute({
      eventCode,
      payload,
    });
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(schedule);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to save practice schedule",
      message: applicationError.message,
    }));
  }
});

scheduleRoutes.post(
  "/:eventCode/schedule/practice/generate",
  requireAuth,
  async (c) => {
    const mutationInputResult = await getScheduleMutationInput(
      c,
      generatePracticeScheduleBodySchema
    );
    if (!mutationInputResult.ok) {
      return mutationInputResult.response;
    }
    const { eventCode, payload } = mutationInputResult.value;

    try {
      const schedule = await generatePracticeScheduleUseCase.execute({
        eventCode,
        payload,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule, 201);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to generate practice schedule",
        message: applicationError.message,
      }));
    }
  }
);

scheduleRoutes.delete(
  "/:eventCode/schedule/practice",
  requireAuth,
  async (c) => {
    const eventCodeResult = getScheduleWriteEventCode(c);
    if (!eventCodeResult.ok) {
      return eventCodeResult.response;
    }
    const eventCode = eventCodeResult.value;

    try {
      const schedule = await deletePracticeMatchUseCase.execute({ eventCode });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to clear practice schedule",
        message: applicationError.message,
      }));
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
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to load qualification schedule",
      message: applicationError.message,
    }));
  }
});

scheduleRoutes.put("/:eventCode/schedule/quals", requireAuth, async (c) => {
  const mutationInputResult = await getScheduleMutationInput(
    c,
    saveQualificationScheduleBodySchema
  );
  if (!mutationInputResult.ok) {
    return mutationInputResult.response;
  }
  const { eventCode, payload } = mutationInputResult.value;

  try {
    const schedule = await saveQualificationScheduleUseCase.execute({
      eventCode,
      payload,
    });
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(schedule);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to save qualification schedule",
      message: applicationError.message,
    }));
  }
});

scheduleRoutes.post(
  "/:eventCode/schedule/quals/generate",
  requireAuth,
  async (c) => {
    const mutationInputResult = await getScheduleMutationInput(
      c,
      generateQualificationScheduleBodySchema,
      {}
    );
    if (!mutationInputResult.ok) {
      return mutationInputResult.response;
    }
    const { eventCode, payload } = mutationInputResult.value;

    try {
      const schedule = await generateQualificationScheduleUseCase.execute({
        eventCode,
        payload,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule, 201);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to generate qualification schedule",
        message: applicationError.message,
      }));
    }
  }
);

scheduleRoutes.delete("/:eventCode/schedule/quals", requireAuth, async (c) => {
  const eventCodeResult = getScheduleWriteEventCode(c);
  if (!eventCodeResult.ok) {
    return eventCodeResult.response;
  }
  const eventCode = eventCodeResult.value;

  try {
    const schedule = await clearQualificationScheduleUseCase.execute({
      eventCode,
    });
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(schedule);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to clear qualification schedule",
      message: applicationError.message,
    }));
  }
});

scheduleRoutes.put(
  "/:eventCode/schedule/practice/active",
  requireAuth,
  async (c) => {
    const mutationInputResult = await getScheduleMutationInput(
      c,
      setScheduleActivationBodySchema
    );
    if (!mutationInputResult.ok) {
      return mutationInputResult.response;
    }
    const { eventCode, payload } = mutationInputResult.value;

    try {
      const schedule = await activateScheduleUseCase.execute({
        eventCode,
        scheduleType: "practice",
        active: payload.active,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to update practice schedule activation",
        message: applicationError.message,
      }));
    }
  }
);

scheduleRoutes.put(
  "/:eventCode/schedule/quals/active",
  requireAuth,
  async (c) => {
    const mutationInputResult = await getScheduleMutationInput(
      c,
      setScheduleActivationBodySchema
    );
    if (!mutationInputResult.ok) {
      return mutationInputResult.response;
    }
    const { eventCode, payload } = mutationInputResult.value;

    try {
      const schedule = await activateScheduleUseCase.execute({
        eventCode,
        scheduleType: "quals",
        active: payload.active,
      });
      outboundSyncPushService.requestEventSync(eventCode);
      return c.json(schedule);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to update qualification schedule activation",
        message: applicationError.message,
      }));
    }
  }
);
