import { Hono } from "hono";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { safeParse } from "valibot";
import { requireAuth } from "../auth/auth.middleware";
import type { AppEnv } from "../common/app-env";
import { requireEventAdmin } from "../common/guards";
import { parseJsonBody } from "../common/http";
import { formatValidationIssues } from "../common/validation";
import { publishDisplayCommandBodySchema } from "./display.schema";
import {
  createDisplaySnapshotHintEvent,
  DISPLAY_SYNC_EVENT_NAME,
  type DisplaySyncEvent,
  displaySyncHub,
} from "./display-sync";

export const displayRoutes = new Hono<AppEnv>();

const SSE_RETRY_MS = 2000;
const SSE_HEARTBEAT_MS = 20_000;

const writeDisplaySyncEvent = async (
  stream: SSEStreamingApi,
  event: DisplaySyncEvent
): Promise<void> => {
  await stream.writeSSE({
    data: JSON.stringify(event),
    event: DISPLAY_SYNC_EVENT_NAME,
    id: `${event.eventCode}:${event.version}`,
    retry: SSE_RETRY_MS,
  });
};

displayRoutes.get("/:eventCode/display/stream", (c) => {
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

    const snapshotEvent = createDisplaySnapshotHintEvent(
      eventCode,
      displaySyncHub.getCurrentVersion(eventCode),
      displaySyncHub.getLatestEvent(eventCode)
    );
    enqueueWrite((streamApi) =>
      writeDisplaySyncEvent(streamApi, snapshotEvent)
    );

    const unsubscribe = displaySyncHub.subscribe(eventCode, (event) => {
      enqueueWrite((streamApi) => writeDisplaySyncEvent(streamApi, event));
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

displayRoutes.post("/:eventCode/display/command", requireAuth, async (c) => {
  const eventCode = c.req.param("eventCode");
  const forbiddenResponse = requireEventAdmin(c, eventCode);
  if (forbiddenResponse) {
    return forbiddenResponse;
  }

  const body = await parseJsonBody(c);
  if (body === null) {
    return c.json({ error: "Body must be valid JSON" }, 400);
  }

  const bodyResult = safeParse(publishDisplayCommandBodySchema, body);
  if (!bodyResult.success) {
    return c.json(
      {
        error: "Validation failed",
        message: formatValidationIssues(bodyResult.issues),
      },
      400
    );
  }

  const { mode, message, startedAtMs } = bodyResult.output;

  displaySyncHub.publish({
    eventCode,
    kind: "COMMAND_ISSUED",
    message: message ?? null,
    mode,
    startedAtMs: startedAtMs ?? null,
  });

  return c.json({ ok: true });
});
