import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  authenticateSyncClient,
  createEventDb,
  createInspectionResultPayload,
  db,
  getEventBootstrap,
  insertEvent,
  insertSyncClient,
  insertSyncOutboundLink,
  insertSyncPolicy,
  openEventDb,
  pushSyncBatch,
  resetSyncTestDatabase,
  SyncError,
  schema,
  TEST_DATA_DIR,
  waitFor,
} from "./sync.test-support";
import { outboundSyncPushService } from "../../infrastructure/services/outbound-sync-push-service";

const EVENT_CODE = "SYNC01";
const PUSH_WORKER_DIR = join(TEST_DATA_DIR, "sync-race");

const waitForCondition = async (
  predicate: () => boolean | Promise<boolean>,
  description: string
): Promise<void> => {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    if (await predicate()) {
      return;
    }
    await Bun.sleep(25);
  }

  throw new Error(`Timed out waiting for ${description}.`);
};

const startMockMachinePushServer = (handler: (
  body: unknown
) => { body: unknown; status?: number }) => {
  let requestCount = 0;
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: async (req) => {
      if (
        req.method === "POST" &&
        new URL(req.url).pathname === "/api/sync/v1/machine/push"
      ) {
        requestCount += 1;
        const payload = await req.json().catch(() => null);
        const result = handler(payload);
        return Response.json(result.body, { status: result.status ?? 200 });
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  return {
    getRequestCount: () => requestCount,
    stop: () => server.stop(true),
    url: `http://127.0.0.1:${server.port}`,
  };
};

const readChildResult = async (
  child: ReturnType<typeof Bun.spawn>
): Promise<{
  code?: string | null;
  message?: string;
  ok: boolean;
  status?: string;
}> => {
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout as ReadableStream<Uint8Array> | null).text(),
    new Response(child.stderr as ReadableStream<Uint8Array> | null).text(),
  ]);
  await child.exited;

  if (stderr.trim()) {
    throw new Error(stderr.trim());
  }

  return JSON.parse(stdout.trim()) as {
    code?: string | null;
    message?: string;
    ok: boolean;
    status?: string;
  };
};

describe("sync service", () => {
  beforeEach(async () => {
    outboundSyncPushService.stop();
    await resetSyncTestDatabase();
    rmSync(PUSH_WORKER_DIR, { force: true, recursive: true });
  });

  afterEach(() => {
    outboundSyncPushService.stop();
  });

  it("authenticates active clients and updates lastUsedAt", () => {
    const secret = insertSyncClient(EVENT_CODE);

    const auth = authenticateSyncClient(secret);
    const client = db.select().from(schema.syncClients).get();

    expect(auth).toEqual({
      allowedResources: ["inspection_results"],
      clientId: "client-1",
      eventCode: EVENT_CODE,
    });
    expect(typeof client?.lastUsedAt).toBe("number");
  });

  it("rejects revoked sync clients", () => {
    const secret = insertSyncClient(EVENT_CODE, { isRevoked: true });

    let error: unknown;
    try {
      authenticateSyncClient(secret);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SyncError);
    expect((error as { code?: string }).code).toBe("CLIENT_REVOKED");
  });

  it("omits a hardcoded timezone from bootstrap responses", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE);

    const bootstrap = await getEventBootstrap(EVENT_CODE);

    expect("timezone" in bootstrap.resources.eventManifest).toBe(false);
  });

  it("applies inspection batches and deduplicates identical retries", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["inspection_results"],
    });

    const payload = createInspectionResultPayload({ batchId: "batch-1" });

    const result = await pushSyncBatch({
      allowedResources: ["inspection_results"],
      clientId: "client-1",
      eventCode: EVENT_CODE,
      payload,
    });
    const duplicate = await pushSyncBatch({
      allowedResources: ["inspection_results"],
      clientId: "client-1",
      eventCode: EVENT_CODE,
      payload,
    });

    const eventDb = openEventDb(EVENT_CODE);
    try {
      const inspection = eventDb
        .query("SELECT status AS status FROM inspections WHERE team_number = ?")
        .get(123) as { status: string } | null;

      expect(result.status).toBe("applied");
      expect(duplicate.status).toBe("duplicate");
      expect(db.select().from(schema.syncBatches).all()).toHaveLength(1);
      expect(inspection?.status).toBe("PASSED");
    } finally {
      eventDb.close();
    }
  });

  it("serializes concurrent writers that reuse the same batchId", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["inspection_results"],
    });
    mkdirSync(PUSH_WORKER_DIR, { recursive: true });

    const workerPath = join(PUSH_WORKER_DIR, "push-worker.ts");
    writeFileSync(
      workerPath,
      `import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const barrierDir = process.env.BARRIER_DIR ?? "";
writeFileSync(join(barrierDir, \`\${process.argv[2]}.ready\`), "");

while (!existsSync(join(barrierDir, "release"))) {
  await Bun.sleep(5);
}

const { pushSyncBatch } = await import(${JSON.stringify(
        join(process.cwd(), "src/bun/server/api/sync/sync.test-support.ts")
      )});
const payload = JSON.parse(process.env.WORKER_PAYLOAD ?? "{}");

try {
  const result = await pushSyncBatch({
    allowedResources: ["inspection_results"],
    clientId: "client-1",
    eventCode: ${JSON.stringify(EVENT_CODE)},
    payload,
  });

  console.log(JSON.stringify({ ok: true, status: result.status }));
  process.exit(0);
} catch (error) {
  const syncError = error as { code?: string; message?: string };
  console.log(
    JSON.stringify({
      code: syncError.code ?? null,
      message: syncError.message ?? String(error),
      ok: false,
    })
  );
  process.exit(0);
}`
    );

    const firstWorker = Bun.spawn({
      cmd: [process.execPath, workerPath, "first"],
      cwd: process.cwd(),
      env: {
        ...process.env,
        BARRIER_DIR: PUSH_WORKER_DIR,
        ELECTROBUN_DATA_DIR: TEST_DATA_DIR,
        WORKER_PAYLOAD: JSON.stringify(
          createInspectionResultPayload({
            batchId: "race-batch",
            status: "PASSED",
          })
        ),
      },
      stderr: "pipe",
      stdout: "pipe",
    });
    const secondWorker = Bun.spawn({
      cmd: [process.execPath, workerPath, "second"],
      cwd: process.cwd(),
      env: {
        ...process.env,
        BARRIER_DIR: PUSH_WORKER_DIR,
        ELECTROBUN_DATA_DIR: TEST_DATA_DIR,
        WORKER_PAYLOAD: JSON.stringify(
          createInspectionResultPayload({
            batchId: "race-batch",
            status: "IN_PROGRESS",
          })
        ),
      },
      stderr: "pipe",
      stdout: "pipe",
    });

    await waitFor(
      () =>
        existsSync(join(PUSH_WORKER_DIR, "first.ready")) &&
        existsSync(join(PUSH_WORKER_DIR, "second.ready")),
      "push workers to become ready"
    );

    writeFileSync(join(PUSH_WORKER_DIR, "release"), "");

    try {
      const [firstResult, secondResult] = await Promise.all([
        readChildResult(firstWorker),
        readChildResult(secondWorker),
      ]);

      const successfulResult = [firstResult, secondResult].find(
        (result) => result.ok
      );
      const failedResult = [firstResult, secondResult].find(
        (result) => !result.ok
      );

      const serverDb = new Database(join(TEST_DATA_DIR, "server.db"));
      try {
        const batchCount = serverDb
          .query("SELECT COUNT(*) AS count FROM sync_batches")
          .get() as { count: number };

        expect(successfulResult?.status).toBe("applied");
        expect(failedResult?.code).toBe("BATCH_HASH_MISMATCH");
        expect(batchCount.count).toBe(1);
      } finally {
        serverDb.close();
      }
    } finally {
      firstWorker.kill();
      secondWorker.kill();
    }
  }, 15_000);

  it("rejects a reused batchId when the payload changes", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["inspection_results"],
    });

    await pushSyncBatch({
      allowedResources: ["inspection_results"],
      clientId: "client-1",
      eventCode: EVENT_CODE,
      payload: createInspectionResultPayload({ batchId: "batch-2" }),
    });

    let error: unknown;
    try {
      await pushSyncBatch({
        allowedResources: ["inspection_results"],
        clientId: "client-1",
        eventCode: EVENT_CODE,
        payload: createInspectionResultPayload({
          batchId: "batch-2",
          status: "IN_PROGRESS",
        }),
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(SyncError);
    expect((error as { code?: string }).code).toBe("BATCH_HASH_MISMATCH");
  });

  it("delivers queued outbound batch and marks success when remote applies", async () => {
    const mockServer = startMockMachinePushServer(() => ({
      body: { batchId: "remote-batch", status: "applied" },
    }));
    try {
      createEventDb(EVENT_CODE, ["123"]);
      insertEvent(EVENT_CODE);
      insertSyncPolicy(EVENT_CODE, {
        isSyncEnabled: true,
      });
      insertSyncOutboundLink(EVENT_CODE, {
        baseUrl: mockServer.url,
      });

      outboundSyncPushService.start();
      const retryResult = await outboundSyncPushService.requestImmediateRetry(
        EVENT_CODE
      );
      expect(typeof retryResult.batchId).toBe("string");

      await waitForCondition(() => mockServer.getRequestCount() > 0, "push call");
      await waitForCondition(async () => {
        const status = await outboundSyncPushService.getEventStatus(EVENT_CODE);
        return status.counts.succeeded > 0;
      }, "outbound success status");

      const status = await outboundSyncPushService.getEventStatus(EVENT_CODE);
      expect(status.counts.succeeded).toBe(1);
      expect(typeof status.lastSuccessAt).toBe("string");

      const batchRow = db
        .select()
        .from(schema.syncOutboundBatches)
        .where(eq(schema.syncOutboundBatches.batchId, retryResult.batchId))
        .get();
      expect(batchRow?.status).toBe("succeeded");
    } finally {
      mockServer.stop();
    }
  });

  it("marks outbound batch as pending_review when remote requires review", async () => {
    const mockServer = startMockMachinePushServer(() => ({
      body: { batchId: "remote-batch", status: "pending_review" },
    }));
    try {
      createEventDb(EVENT_CODE, ["123"]);
      insertEvent(EVENT_CODE);
      insertSyncPolicy(EVENT_CODE, {
        isSyncEnabled: true,
      });
      insertSyncOutboundLink(EVENT_CODE, {
        baseUrl: mockServer.url,
      });

      outboundSyncPushService.start();
      await outboundSyncPushService.requestImmediateRetry(EVENT_CODE);

      await waitForCondition(() => mockServer.getRequestCount() > 0, "push call");
      await waitForCondition(async () => {
        const status = await outboundSyncPushService.getEventStatus(EVENT_CODE);
        return status.counts.pending_review > 0;
      }, "pending review status");

      const status = await outboundSyncPushService.getEventStatus(EVENT_CODE);
      expect(status.counts.pending_review).toBe(1);
      expect(status.lastError).toBe("Remote batch is pending review.");
    } finally {
      mockServer.stop();
    }
  });

  it("rejects manual outbound retry when sync is disabled", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE, {
      isSyncEnabled: false,
    });
    insertSyncOutboundLink(EVENT_CODE, {
      baseUrl: "http://127.0.0.1:39999",
    });

    let error: unknown;
    try {
      await outboundSyncPushService.requestImmediateRetry(EVENT_CODE);
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("Sync is disabled");
  });
});
