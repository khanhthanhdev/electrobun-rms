import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { ServiceError } from "../../services/manual-event-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { saveMatchAllianceScoreBodySchema } from "./scoring.schema";
import {
  getEventMatchHistory,
  getEventMatchResults,
  getEventMatchScoresheet,
  saveEventMatchAllianceScore,
} from "./scoring.service";
import {
  createScoringSnapshotHintEvent,
  SCORING_SYNC_EVENT_NAME,
  type ScoringSyncEvent,
  scoringSyncHub,
} from "./scoring-sync";

export const scoringRoutes = new Hono<AppEnv>();

const SSE_RETRY_MS = 2000;
const SSE_HEARTBEAT_MS = 20_000;
const POSITIVE_INTEGER_PARAM_PATTERN = /^[1-9]\d*$/;
const READ_MATCH_TYPES = new Set(["practice", "quals", "elims"]);

const isReadMatchType = (
  value: string
): value is "practice" | "quals" | "elims" => READ_MATCH_TYPES.has(value);

const parsePositiveIntegerParam = (value: string): number | null => {
  if (!POSITIVE_INTEGER_PARAM_PATTERN.test(value)) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
};

const writeScoringSyncEvent = async (
  stream: SSEStreamingApi,
  event: ScoringSyncEvent
): Promise<void> => {
  await stream.writeSSE({
    data: JSON.stringify(event),
    event: SCORING_SYNC_EVENT_NAME,
    id: `${event.eventCode}:${event.version}`,
    retry: SSE_RETRY_MS,
  });
};

scoringRoutes.get("/:eventCode/scoring/stream", (c) => {
  const eventCode = c.req.param("eventCode");

  return streamSSE(c, async (stream) => {
    let queuedWrite = Promise.resolve();

    const enqueueWrite = (
      writeOperation: (streamApi: SSEStreamingApi) => Promise<void>
    ): void => {
      queuedWrite = queuedWrite
        .then(async () => {
          if (stream.aborted || stream.closed) {
            return;
          }
          await writeOperation(stream);
        })
        .catch(() => {
          // Ignore write failures after disconnect.
        });
    };

    const snapshotEvent = createScoringSnapshotHintEvent(
      eventCode,
      scoringSyncHub.getCurrentVersion(eventCode)
    );
    enqueueWrite((streamApi) =>
      writeScoringSyncEvent(streamApi, snapshotEvent)
    );

    const unsubscribe = scoringSyncHub.subscribe(eventCode, (event) => {
      enqueueWrite((streamApi) => writeScoringSyncEvent(streamApi, event));
    });

    const heartbeatIntervalId = setInterval(() => {
      enqueueWrite(async (streamApi) => {
        await streamApi.write(": heartbeat\n\n");
      });
    }, SSE_HEARTBEAT_MS);

    let isCleanedUp = false;
    const cleanup = (): void => {
      if (isCleanedUp) {
        return;
      }
      isCleanedUp = true;
      clearInterval(heartbeatIntervalId);
      unsubscribe();
    };

    stream.onAbort(() => {
      cleanup();
    });

    try {
      while (!stream.aborted) {
        await stream.sleep(1000);
      }
    } finally {
      cleanup();
      await queuedWrite;
    }
  });
});

scoringRoutes.put("/:eventCode/scoring/matches", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(saveMatchAllianceScoreBodySchema, body);
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
    const result = saveEventMatchAllianceScore(eventCode, bodyResult.output);
    scoringSyncHub.publish({
      eventCode,
      kind: "SCORE_UPDATED",
      matchNumber: bodyResult.output.matchNumber,
      matchType: bodyResult.output.matchType,
    });
    return c.json(result);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to save match score", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scoringRoutes.get("/:eventCode/scoring/:matchType/results", (c) => {
  const eventCode = c.req.param("eventCode");

  const matchType = c.req.param("matchType");
  if (!isReadMatchType(matchType)) {
    return c.json({ error: "Invalid match type" }, 400);
  }

  try {
    const results = getEventMatchResults(eventCode, matchType);
    return c.json(results);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to load match results", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});

scoringRoutes.get(
  "/:eventCode/scoring/:matchType/:matchNumber/history",
  (c) => {
    const eventCode = c.req.param("eventCode");

    const matchType = c.req.param("matchType");
    if (!isReadMatchType(matchType)) {
      return c.json({ error: "Invalid match type" }, 400);
    }

    const matchNumber = parsePositiveIntegerParam(c.req.param("matchNumber"));
    if (matchNumber === null) {
      return c.json({ error: "Invalid match number" }, 400);
    }

    try {
      const history = getEventMatchHistory(eventCode, matchType, matchNumber);
      return c.json(history);
    } catch (error) {
      if (error instanceof ServiceError) {
        return c.json(
          { error: "Failed to load match history", message: error.message },
          error.status as 400 | 404 | 500
        );
      }
      throw error;
    }
  }
);

scoringRoutes.get("/:eventCode/scoring/:matchType/:matchNumber", (c) => {
  const eventCode = c.req.param("eventCode");

  const matchType = c.req.param("matchType");
  if (!isReadMatchType(matchType)) {
    return c.json({ error: "Invalid match type" }, 400);
  }

  const matchNumber = parsePositiveIntegerParam(c.req.param("matchNumber"));
  if (matchNumber === null) {
    return c.json({ error: "Invalid match number" }, 400);
  }

  try {
    const scoresheet = getEventMatchScoresheet(
      eventCode,
      matchType,
      matchNumber
    );
    return c.json(scoresheet);
  } catch (error) {
    if (error instanceof ServiceError) {
      return c.json(
        { error: "Failed to load match scoresheet", message: error.message },
        error.status as 400 | 404 | 500
      );
    }
    throw error;
  }
});
