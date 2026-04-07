import type { SSEStreamingApi } from "hono/streaming";

export const awaitStreamClose = (stream: SSEStreamingApi): Promise<void> =>
  new Promise<void>((resolve) => {
    if (stream.aborted) {
      resolve();
      return;
    }
    stream.onAbort(resolve);
  });
