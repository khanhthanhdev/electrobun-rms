import {
  type MatchControlState,
  matchControlLoadBodySchema,
  matchControlTransitionBodySchema,
} from "@shared/match-control";
import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { SQLiteScoringRepository } from "../../infrastructure/adapters/scoring";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { awaitStreamClose } from "../common/sse";
import { formatValidationIssues } from "../common/validation";
import { publishDisplayFromMatchControl } from "../display/display-match-control-bridge";
import {
  applyTransition,
  getMatchControlState,
  type MatchControlCommand,
  scheduleAutoComplete,
  type TransitionError,
  type TransitionResult,
} from "./match-control-state";
import {
  createMatchControlSnapshotHintEvent,
  MATCH_CONTROL_SYNC_EVENT_NAME,
  type MatchControlSyncEvent,
  matchControlSyncHub,
} from "./match-control-sync";

export const matchControlRoutes = new Hono<AppEnv>();

const SSE_RETRY_MS = 2000;
const SSE_HEARTBEAT_MS = 20_000;

const scoringRepository = new SQLiteScoringRepository();

// ---------------------------------------------------------------------------
// Transition handler helper
// ---------------------------------------------------------------------------

const handleTransition = (
  result: TransitionResult | TransitionError,
  trigger: MatchControlCommand["type"],
  eventCode: string,
  c: { json: (data: unknown, status?: number) => Response },
  preTransitionState?: MatchControlState
): Response => {
  if ("error" in result) {
    const currentVersion = matchControlSyncHub.getCurrentVersion(eventCode);
    return c.json(
      {
        error: result.error,
        message: result.message,
        currentState: { ...result.currentState, version: currentVersion },
      },
      409
    );
  }

  // On ABORT, clear saved scores so replayed match starts from zero.
  if (trigger === "ABORT" && preTransitionState?.activeMatch) {
    const { matchType, matchNumber } = preTransitionState.activeMatch;
    scoringRepository
      .clearMatchScores(eventCode, matchType, matchNumber)
      .catch((err) => {
        console.error(
          `Failed to clear scores for ${matchType} #${matchNumber} in ${eventCode}:`,
          err
        );
      });
  }

  // Publish assigns the real version via the sync hub's single counter.
  const published = matchControlSyncHub.publish(result.state);

  const bridgeContext =
    trigger === "COMMIT" && preTransitionState
      ? { committedMatch: preTransitionState.activeMatch }
      : undefined;
  publishDisplayFromMatchControl(published.state, trigger, bridgeContext);

  if (trigger === "START") {
    scheduleAutoComplete(
      eventCode,
      () => matchControlSyncHub.getCurrentVersion(eventCode),
      (autoResult) => {
        const autoPublished = matchControlSyncHub.publish(autoResult.state);
        publishDisplayFromMatchControl(autoPublished.state, "AUTO_COMPLETE");
      }
    );
  }

  return c.json({ state: published.state, version: published.version });
};

// ---------------------------------------------------------------------------
// SSE stream
// ---------------------------------------------------------------------------

const writeMatchControlSyncEvent = async (
  stream: SSEStreamingApi,
  event: MatchControlSyncEvent
): Promise<void> => {
  await stream.writeSSE({
    data: JSON.stringify(event),
    event: MATCH_CONTROL_SYNC_EVENT_NAME,
    id: `${event.eventCode}:${event.version}`,
    retry: SSE_RETRY_MS,
  });
};

matchControlRoutes.get("/:eventCode/match-control/stream", (c) => {
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

    const snapshotEvent = createMatchControlSnapshotHintEvent(
      eventCode,
      matchControlSyncHub.getCurrentVersion(eventCode),
      matchControlSyncHub.getLatestEvent(eventCode)
    );
    enqueueWrite((streamApi) =>
      writeMatchControlSyncEvent(streamApi, snapshotEvent)
    );

    const unsubscribe = matchControlSyncHub.subscribe(eventCode, (event) => {
      enqueueWrite((streamApi) => writeMatchControlSyncEvent(streamApi, event));
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
      await awaitStreamClose(stream);
    } finally {
      cleanup();
      await queuedWrite;
    }
  });
});

// ---------------------------------------------------------------------------
// State endpoint (initial hydration)
// ---------------------------------------------------------------------------

matchControlRoutes.get("/:eventCode/match-control/state", (c) => {
  const eventCode = c.req.param("eventCode");
  const state = getMatchControlState(eventCode);
  const version = matchControlSyncHub.getCurrentVersion(eventCode);
  return c.json({ state: { ...state, version }, version });
});

// ---------------------------------------------------------------------------
// Transition routes
// ---------------------------------------------------------------------------

matchControlRoutes.post(
  "/:eventCode/match-control/load",
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

    const bodyResult = safeParse(matchControlLoadBodySchema, body);
    if (!bodyResult.success) {
      return c.json(
        {
          error: "Validation failed",
          message: formatValidationIssues(bodyResult.issues),
        },
        400
      );
    }

    const currentVersion = matchControlSyncHub.getCurrentVersion(eventCode);
    const result = applyTransition(
      eventCode,
      {
        type: "LOAD",
        match: bodyResult.output.match,
        expectedVersion: bodyResult.output.expectedVersion,
      },
      currentVersion
    );

    return handleTransition(result, "LOAD", eventCode, c);
  }
);

const createTransitionRoute = (
  path: string,
  commandType: Exclude<MatchControlCommand["type"], "LOAD" | "AUTO_COMPLETE">
) => {
  matchControlRoutes.post(
    `/:eventCode/match-control/${path}`,
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

      const bodyResult = safeParse(matchControlTransitionBodySchema, body);
      if (!bodyResult.success) {
        return c.json(
          {
            error: "Validation failed",
            message: formatValidationIssues(bodyResult.issues),
          },
          400
        );
      }

      const preState = getMatchControlState(eventCode);
      const currentVersion = matchControlSyncHub.getCurrentVersion(eventCode);
      const result = applyTransition(
        eventCode,
        {
          type: commandType,
          expectedVersion: bodyResult.output.expectedVersion,
        },
        currentVersion
      );

      return handleTransition(result, commandType, eventCode, c, preState);
    }
  );
};

createTransitionRoute("unload", "UNLOAD");
createTransitionRoute("show-preview", "SHOW_PREVIEW");
createTransitionRoute("show-match", "SHOW_MATCH");
createTransitionRoute("start", "START");
createTransitionRoute("abort", "ABORT");
createTransitionRoute("commit", "COMMIT");
