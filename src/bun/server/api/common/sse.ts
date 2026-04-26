import type { SSEStreamingApi } from "hono/streaming";

export const awaitStreamClose = (stream: SSEStreamingApi): Promise<void> =>
  new Promise<void>((resolve) => {
    if (stream.aborted) {
      resolve();
      return;
    }
    stream.onAbort(resolve);
  });

interface QueuedHeartbeatSseOptions<TEvent> {
  heartbeatMs: number;
  subscribe: (onEvent: (event: TEvent) => void) => () => void;
  writeEvent: (event: TEvent) => Promise<void>;
  writeInitial: () => Promise<void>;
}

export const runQueuedHeartbeatSse = async <TEvent>(
  stream: SSEStreamingApi,
  options: QueuedHeartbeatSseOptions<TEvent>
): Promise<void> => {
  let queuedWrite = Promise.resolve();

  const enqueueWrite = (writeOperation: () => Promise<void>): void => {
    queuedWrite = queuedWrite
      .then(async () => {
        if (stream.aborted || stream.closed) {
          return;
        }
        await writeOperation();
      })
      .catch(() => {
        // Ignore write failures after disconnect.
      });
  };

  enqueueWrite(options.writeInitial);

  const unsubscribe = options.subscribe((event) => {
    enqueueWrite(() => options.writeEvent(event));
  });

  const heartbeatIntervalId = setInterval(() => {
    enqueueWrite(async () => {
      await stream.write(": heartbeat\n\n");
    });
  }, options.heartbeatMs);

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
};
