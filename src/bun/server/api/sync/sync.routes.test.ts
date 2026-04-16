import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
  createEventDb,
  createInspectionResultPayload,
  createSyncTestApp,
  createToken,
  db,
  insertEvent,
  insertSyncClient,
  insertSyncOutboundLink,
  insertSyncPolicy,
  openEventDb,
  resetSyncTestDatabase,
  schema,
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

  it("accepts case-insensitive bearer auth scheme", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE);
    const secret = insertSyncClient(EVENT_CODE);
    const app = createSyncTestApp();

    const response = await app.request("http://localhost/machine/bootstrap", {
      headers: { authorization: `bearer ${secret}` },
    });

    expect(response.status).toBe(200);
  });

  it("validates resource records against declared resourceType", async () => {
    createEventDb(EVENT_CODE, ["123", "456"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["match_results"],
    });
    const secret = insertSyncClient(EVENT_CODE, {
      allowedResources: ["match_results"],
    });
    const app = createSyncTestApp();

    const response = await app.request("http://localhost/machine/push", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        batchId: "route-batch-mismatch",
        definitionVersion: "2025.1",
        producedAt: "2026-03-23T10:00:00.000Z",
        schemaVersion: "2026-03-08",
        resources: [
          {
            resourceType: "match_results",
            mode: "upsert",
            records: [
              {
                matchKey: "P1",
                phase: "PRACTICE",
                matchNumber: 1,
                status: "SCHEDULED",
                alliances: [
                  { color: "RED", teamNumbers: ["123"] },
                  { color: "BLUE", teamNumbers: ["456"] },
                ],
              },
            ],
          },
        ],
      }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "VALIDATION_FAILED",
    });
  });

  it("returns NOT_FOUND when local event database is missing on push", async () => {
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE, {
      allowedPushResources: ["inspection_results"],
    });
    const secret = insertSyncClient(EVENT_CODE, {
      allowedResources: ["inspection_results"],
    });
    const app = createSyncTestApp();

    const response = await app.request("http://localhost/machine/push", {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(
        createInspectionResultPayload({
          batchId: "route-batch-missing-event-db",
        })
      ),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: "NOT_FOUND",
    });
  });

  it("exposes outbound status and manual retry controls", async () => {
    createEventDb(EVENT_CODE, ["123"]);
    insertEvent(EVENT_CODE);
    insertSyncPolicy(EVENT_CODE, { isSyncEnabled: true });
    insertSyncOutboundLink(EVENT_CODE);
    const adminToken = await createToken({
      roles: [{ role: "ADMIN", event: EVENT_CODE }],
    });
    const app = createSyncTestApp();

    const statusResponse = await app.request(
      `http://localhost/admin/seasons/2025/events/${EVENT_CODE}/outbound-status`,
      {
        headers: { authorization: `Bearer ${adminToken}` },
      }
    );
    expect(statusResponse.status).toBe(200);
    expect(await statusResponse.json()).toMatchObject({
      eventCode: EVENT_CODE,
      hasOutboundLink: true,
      isSyncEnabled: true,
    });

    const retryResponse = await app.request(
      `http://localhost/admin/seasons/2025/events/${EVENT_CODE}/outbound-retry`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }
    );
    expect(retryResponse.status).toBe(200);
    expect(await retryResponse.json()).toMatchObject({
      eventCode: EVENT_CODE,
      success: true,
    });

    const batches = db
      .select()
      .from(schema.syncOutboundBatches)
      .where(eq(schema.syncOutboundBatches.eventCode, EVENT_CODE))
      .all();
    expect(batches.length).toBe(1);
    expect(batches[0]?.status).toBe("queued");
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

  it("allows only one successful review decision under concurrency", async () => {
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
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(
        createInspectionResultPayload({ batchId: "route-batch-race-review" })
      ),
    });
    const pushPayload = (await pushResponse.json()) as { changeSetId: string };

    const [first, second] = await Promise.all([
      app.request(
        `http://localhost/admin/batches/${pushPayload.changeSetId}/review`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${adminToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ decision: "APPROVE" }),
        }
      ),
      app.request(
        `http://localhost/admin/batches/${pushPayload.changeSetId}/review`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${adminToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ decision: "APPROVE" }),
        }
      ),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 409]);
  });
});
