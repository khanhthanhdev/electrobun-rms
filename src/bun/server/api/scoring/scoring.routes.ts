import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import {
  GetMatchHistoryUseCase,
  GetMatchResultsUseCase,
  GetMatchScoresheetUseCase,
  SubmitAllianceScoreUseCase,
} from "../../application/use-cases/scoring";
import { SQLiteScoringRepository } from "../../infrastructure/adapters/scoring";
import { outboundSyncPushService } from "../../infrastructure/services/outbound-sync-push-service";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin, requireScorer } from "../common/guards";
import {
  getEventCodeWithGuard,
  parseJsonBodyOrResponse,
  safeParseOrResponse,
  toApplicationErrorResponse,
} from "../common/route-handler-helpers";
import { runQueuedHeartbeatSse } from "../common/sse";
import { formatValidationIssues } from "../common/validation";
import { getMatchControlState } from "../match-control/match-control-state";
import { matchControlSyncHub } from "../match-control/match-control-sync";
import { saveMatchAllianceScoreBodySchema } from "./scoring.schema";
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
const scoringRepository = new SQLiteScoringRepository();
const submitAllianceScoreUseCase = new SubmitAllianceScoreUseCase(
  scoringRepository
);
const getMatchResultsUseCase = new GetMatchResultsUseCase(scoringRepository);
const getMatchHistoryUseCase = new GetMatchHistoryUseCase(scoringRepository);
const getMatchScoresheetUseCase = new GetMatchScoresheetUseCase(
  scoringRepository
);

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

scoringRoutes.get("/:eventCode/scoring/stream", requireAuth, (c) => {
  const eventCodeResult = getEventCodeWithGuard(c, requireScorer);
  if (!eventCodeResult.ok) {
    return eventCodeResult.response;
  }
  const eventCode = eventCodeResult.value;

  return streamSSE(c, async (stream) => {
    const snapshotEvent = createScoringSnapshotHintEvent(
      eventCode,
      scoringSyncHub.getCurrentVersion(eventCode)
    );
    await runQueuedHeartbeatSse(stream, {
      heartbeatMs: SSE_HEARTBEAT_MS,
      writeInitial: () => writeScoringSyncEvent(stream, snapshotEvent),
      subscribe: (onEvent: (event: ScoringSyncEvent) => void) =>
        scoringSyncHub.subscribe(eventCode, onEvent),
      writeEvent: (event) => writeScoringSyncEvent(stream, event),
    });
  });
});

scoringRoutes.put("/:eventCode/scoring/matches", requireAuth, async (c) => {
  const eventCodeResult = getEventCodeWithGuard(c, requireEventAdmin);
  if (!eventCodeResult.ok) {
    return eventCodeResult.response;
  }
  const eventCode = eventCodeResult.value;

  const bodyResult = await parseJsonBodyOrResponse(
    c,
    { error: "Body must be valid JSON" },
    400
  );
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsedBodyResult = safeParseOrResponse(
    c,
    saveMatchAllianceScoreBodySchema,
    bodyResult.value,
    (issues) => ({
      error: "Validation failed",
      message: formatValidationIssues(issues),
    })
  );
  if (!parsedBodyResult.ok) {
    return parsedBodyResult.response;
  }
  const payload = parsedBodyResult.value;

  try {
    const result = await submitAllianceScoreUseCase.execute({
      eventCode,
      payload,
    });
    scoringSyncHub.publish({
      eventCode,
      kind: "SCORE_UPDATED",
      matchNumber: payload.matchNumber,
      matchType: payload.matchType,
    });
    matchControlSyncHub.publish(getMatchControlState(eventCode));
    outboundSyncPushService.requestEventSync(eventCode);
    return c.json(result);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to save match score",
      message: applicationError.message,
    }));
  }
});

scoringRoutes.get("/:eventCode/scoring/:matchType/results", async (c) => {
  const eventCode = c.req.param("eventCode");

  const matchType = c.req.param("matchType");
  if (!isReadMatchType(matchType)) {
    return c.json({ error: "Invalid match type" }, 400);
  }

  try {
    const results = await getMatchResultsUseCase.execute({
      eventCode,
      matchType,
    });
    return c.json(results);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to load match results",
      message: applicationError.message,
    }));
  }
});

scoringRoutes.get(
  "/:eventCode/scoring/:matchType/:matchNumber/history",
  async (c) => {
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
      const history = await getMatchHistoryUseCase.execute({
        eventCode,
        matchType,
        matchNumber,
      });
      return c.json(history);
    } catch (error) {
      return toApplicationErrorResponse(c, error, (applicationError) => ({
        error: "Failed to load match history",
        message: applicationError.message,
      }));
    }
  }
);

scoringRoutes.get("/:eventCode/scoring/:matchType/:matchNumber", async (c) => {
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
    const scoresheet = await getMatchScoresheetUseCase.execute({
      eventCode,
      matchType,
      matchNumber,
    });
    return c.json(scoresheet);
  } catch (error) {
    return toApplicationErrorResponse(c, error, (applicationError) => ({
      error: "Failed to load match scoresheet",
      message: applicationError.message,
    }));
  }
});
