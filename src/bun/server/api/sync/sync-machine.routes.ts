import { Hono } from "hono";
import { safeParse } from "valibot";
import type { AppEnv } from "../common/app-env";
import { parseJsonBody } from "../common/http";
import {
  eventBootstrapResponseSchema,
  pushSyncBatchRequestSchema,
} from "./sync.schema";
import {
  authenticateSyncClientUseCase,
  BEARER_TOKEN_REGEX,
  getEventBootstrapUseCase,
  pushSyncBatchUseCase,
  toSyncErrorResponse,
} from "./sync.shared";

export const syncMachineRoutes = new Hono<AppEnv>();

// Machine Bootstrap Endpoint
syncMachineRoutes.get("/machine/bootstrap", async (c) => {
  const authorization = c.req.header("authorization");
  if (!(authorization && BEARER_TOKEN_REGEX.test(authorization))) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      401
    );
  }

  const token = authorization.replace(BEARER_TOKEN_REGEX, "").trim();
  if (!token) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      401
    );
  }

  try {
    const auth = await authenticateSyncClientUseCase.execute({
      bearerToken: token,
    });
    const bootstrap = await getEventBootstrapUseCase.execute({
      eventCode: auth.eventCode,
    });

    // Validate response schema (dev safety)
    const result = safeParse(eventBootstrapResponseSchema, bootstrap);
    if (!result.success) {
      return c.json(
        {
          error: "INTERNAL_ERROR",
          issues: result.issues,
          message: "Bootstrap response failed schema validation.",
        },
        500
      );
    }

    return c.json(bootstrap);
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});

// Machine Push Endpoint
syncMachineRoutes.post("/machine/push", async (c) => {
  const authorization = c.req.header("authorization");
  if (!(authorization && BEARER_TOKEN_REGEX.test(authorization))) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      401
    );
  }

  const token = authorization.replace(BEARER_TOKEN_REGEX, "").trim();
  if (!token) {
    return c.json(
      { error: "UNAUTHORIZED", message: "Bearer token required" },
      401
    );
  }

  try {
    const auth = await authenticateSyncClientUseCase.execute({
      bearerToken: token,
    });
    const body = await parseJsonBody(c);
    if (body === null) {
      return c.json(
        { error: "VALIDATION_FAILED", message: "Body must be valid JSON." },
        400
      );
    }

    // Validate payload schema
    const result = safeParse(pushSyncBatchRequestSchema, body);
    if (!result.success) {
      return c.json(
        {
          error: "VALIDATION_FAILED",
          issues: result.issues,
          message: "Push payload failed validation.",
        },
        400
      );
    }

    const pushResult = await pushSyncBatchUseCase.execute({
      clientId: auth.clientId,
      eventCode: auth.eventCode,
      allowedResources: auth.allowedResources,
      payload: result.output,
    });

    return c.json({
      batchId: pushResult.batchId,
      status: pushResult.status,
      changeSetId: pushResult.changeSetId,
      receivedAt: new Date().toISOString(),
      warnings:
        pushResult.warnings.length > 0 ? pushResult.warnings : undefined,
    });
  } catch (error) {
    const response = toSyncErrorResponse(error);
    return c.json(response.body, response.status);
  }
});
