import { beforeEach, describe, expect, it } from "bun:test";
import {
  createEventDb,
  createInspectionResultPayload,
  createSyncTestApp,
  createToken,
  insertEvent,
  insertSyncClient,
  insertSyncPolicy,
  openEventDb,
  resetSyncTestDatabase,
} from "./sync.test-support";

const EVENT_CODE = "SYNCRT";

describe("sync routes", () => {
  beforeEach(async () => {
    await resetSyncTestDatabase();
  });

  it("preserves machine bootstrap and push contracts", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["inspection_results"],
    });
    const secret = insertSyncClient(EVENT_CODE);
    const app = createSyncTestApp();

    const bootstrapResponse = await app.request(
      "http://localhost/machine/bootstrap",
      {
        headers: { authorization: `Bearer ${secret}` },
      }
    );
    expect(bootstrapResponse.status).toBe(200);
    expect(await bootstrapResponse.json()).toMatchObject({
      resources: {
        eventManifest: {
          eventCode: EVENT_CODE,
        },
      },
      schemaVersion: "2026-03-08",
    });

    const pushBody = createInspectionResultPayload({
      batchId: "route-batch-1",
    });
    const pushResponse = await app.request("http://localhost/machine/push", {
      body: JSON.stringify(pushBody),
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(pushResponse.status).toBe(200);
    const pushPayload = (await pushResponse.json()) as {
      batchId: string;
      changeSetId?: string;
      status: string;
    };
    expect(pushPayload.batchId).toBe("route-batch-1");
    expect(pushPayload.status).toBe("applied");
    expect(typeof pushPayload.changeSetId).toBe("string");

    const duplicateResponse = await app.request(
      "http://localhost/machine/push",
      {
        body: JSON.stringify(pushBody),
        headers: {
          authorization: `Bearer ${secret}`,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );
    expect(duplicateResponse.status).toBe(200);
    expect(await duplicateResponse.json()).toMatchObject({
      batchId: "route-batch-1",
      status: "duplicate",
    });
  });

  it("preserves admin batch review flow", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["inspection_results"],
      reviewMode: "MANUAL_REVIEW",
    });
    const secret = insertSyncClient(EVENT_CODE);
    const adminToken = await createToken({
      roles: [{ role: "ADMIN", event: EVENT_CODE }],
    });
    const app = createSyncTestApp();

    const pushResponse = await app.request("http://localhost/machine/push", {
      body: JSON.stringify(
        createInspectionResultPayload({ batchId: "route-batch-2" })
      ),
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
    expect(pushResponse.status).toBe(200);
    const pushPayload = (await pushResponse.json()) as {
      changeSetId: string;
      status: string;
    };
    expect(pushPayload.status).toBe("pending_review");

    const reviewResponse = await app.request(
      `http://localhost/admin/batches/${pushPayload.changeSetId}/review`,
      {
        body: JSON.stringify({ decision: "APPROVE" }),
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        method: "POST",
      }
    );

    expect(reviewResponse.status).toBe(200);
    expect(await reviewResponse.json()).toMatchObject({
      changeSetId: pushPayload.changeSetId,
      newStatus: "applied",
      success: true,
    });

    const eventDb = openEventDb(EVENT_CODE);
    try {
      const inspection = eventDb
        .query("SELECT status AS status FROM inspections WHERE team_number = ?")
        .get(123) as { status: string } | null;

      expect(inspection?.status).toBe("PASSED");
    } finally {
      eventDb.close();
    }
  });
});
