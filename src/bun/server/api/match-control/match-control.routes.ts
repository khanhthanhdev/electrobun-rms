import {
  type MatchControlState,
  matchControlClearScoresBodySchema,
  matchControlLoadBodySchema,
  matchControlShowResultsBodySchema,
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
import { displaySyncHub } from "../display/display-sync";
import { scoringSyncHub } from "../scoring/scoring-sync";
import {
  applyTransition,
  getMatchControlState,
  type MatchControlCommand,
  restoreMatchControlState,
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

const publishCurrentMatchControlState = (
  eventCode: string
): MatchControlSyncEvent => {
  const state = getMatchControlState(eventCode);
  return matchControlSyncHub.publish(state);
};

const publishScoreMutation = (
  eventCode: string,
  matchType: string,
  matchNumber: number
): void => {
  scoringSyncHub.publish({
    eventCode,
    kind: "SCORE_UPDATED",
    matchNumber,
    matchType,
  });
};

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
    const preLoadState = getMatchControlState(eventCode);
    const result = applyTransition(
      eventCode,
      {
        type: "LOAD",
        match: bodyResult.output.match,
        expectedVersion: bodyResult.output.expectedVersion,
      },
      currentVersion
    );

    if ("state" in result && bodyResult.output.resetScoresBeforeLoad) {
      try {
        await scoringRepository.clearMatchScores(
          eventCode,
          bodyResult.output.match.matchType,
          bodyResult.output.match.matchNumber
        );
        publishScoreMutation(
          eventCode,
          bodyResult.output.match.matchType,
          bodyResult.output.match.matchNumber
        );
      } catch (err) {
        restoreMatchControlState(eventCode, preLoadState);
        console.error(
          `Failed to clear scores for ${bodyResult.output.match.matchType} #${bodyResult.output.match.matchNumber} in ${eventCode}:`,
          err
        );
        return c.json(
          {
            error: "INTERNAL",
            message: "Failed to clear match scores before loading.",
          },
          500
        );
      }
    }

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
      if (
        commandType === "ABORT" &&
        preState.activeState === "IN_PROGRESS" &&
        preState.activeMatch &&
        bodyResult.output.expectedVersion === currentVersion
      ) {
        const { matchType, matchNumber } = preState.activeMatch;
        try {
          await scoringRepository.clearMatchScores(
            eventCode,
            matchType,
            matchNumber
          );
          publishScoreMutation(eventCode, matchType, matchNumber);
        } catch (err) {
          console.error(
            `Failed to clear scores for ${matchType} #${matchNumber} in ${eventCode}:`,
            err
          );
          return c.json(
            {
              error: "INTERNAL",
              message: "Failed to clear match scores.",
            },
            500
          );
        }
      }
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

// ---------------------------------------------------------------------------
// Show committed match results on the audience display. This is intentionally
// separate from COMMIT so score finalization and public posting are two
// explicit operator actions.
// ---------------------------------------------------------------------------

matchControlRoutes.post(
  "/:eventCode/match-control/show-results",
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

    const bodyResult = safeParse(matchControlShowResultsBodySchema, body);
    if (!bodyResult.success) {
      return c.json(
        {
          error: "Validation failed",
          message: formatValidationIssues(bodyResult.issues),
        },
        400
      );
    }

    const { match } = bodyResult.output;
    let isCommitted = false;
    try {
      const results = await scoringRepository.getMatchResults(
        eventCode,
        match.matchType
      );
      const result = results.find(
        (row) => row.matchNumber === match.matchNumber
      );
      isCommitted =
        result?.redScore !== null &&
        result?.redScore !== undefined &&
        result?.blueScore !== null &&
        result?.blueScore !== undefined;
    } catch (err) {
      console.error(
        `Failed to verify committed result for ${match.matchType} #${match.matchNumber} in ${eventCode}:`,
        err
      );
      return c.json(
        {
          error: "INTERNAL",
          message: "Failed to verify match results.",
        },
        500
      );
    }

    if (!isCommitted) {
      return c.json(
        {
          error: "MATCH_NOT_COMMITTED",
          message: "Cannot show results for a match without committed scores.",
        },
        409
      );
    }

    displaySyncHub.publish({
      activeMatch: match,
      eventCode,
      kind: "COMMAND_ISSUED",
      loadedMatch: null,
      mode: "match-winner",
      startedAtMs: null,
    });

    return c.json({ ok: true });
  }
);

// ---------------------------------------------------------------------------
// Reset scores for a non-active, non-loaded match (UNPLAYED / INCOMPLETE /
// COMMITTED rows in the schedule). Wipes saved scores so the row returns to
// the UNPLAYED state and can be re-played from scratch.
// ---------------------------------------------------------------------------

matchControlRoutes.post(
  "/:eventCode/match-control/clear-scores",
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

    const bodyResult = safeParse(matchControlClearScoresBodySchema, body);
    if (!bodyResult.success) {
      return c.json(
        {
          error: "Validation failed",
          message: formatValidationIssues(bodyResult.issues),
        },
        400
      );
    }

    const { matchType, matchNumber } = bodyResult.output;

    // Refuse to wipe scores for the loaded or active match — the match-control
    // state machine owns those slots and abort/unload should be used instead.
    const state = getMatchControlState(eventCode);
    const isLoaded =
      state.loadedMatch?.matchNumber === matchNumber &&
      state.loadedMatch?.matchType === matchType;
    const isActive =
      state.activeMatch?.matchNumber === matchNumber &&
      state.activeMatch?.matchType === matchType;
    if (isLoaded || isActive) {
      return c.json(
        {
          error: "MATCH_BUSY",
          message:
            "Cannot reset scores for a match that is currently loaded or active. Unload or abort it first.",
        },
        409
      );
    }

    try {
      await scoringRepository.clearMatchScores(
        eventCode,
        matchType,
        matchNumber
      );
    } catch (err) {
      console.error(
        `Failed to clear scores for ${matchType} #${matchNumber} in ${eventCode}:`,
        err
      );
      return c.json(
        {
          error: "INTERNAL",
          message: "Failed to clear match scores.",
        },
        500
      );
    }

    // Notify every page whose visible state is derived from scores:
    // scoring/referee views, audience display bridge, and match-control
    // schedule subscribers.
    publishScoreMutation(eventCode, matchType, matchNumber);
    const published = publishCurrentMatchControlState(eventCode);

    return c.json({
      ok: true,
      state: published.state,
      version: published.version,
    });
  }
);
