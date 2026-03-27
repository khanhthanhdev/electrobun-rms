import { beforeEach, describe, expect, it, jest } from "bun:test";
import {
  createInspectionEventDb,
  createInspectionTestApp,
  createInspectionToken,
  INSPECTION_SYNC_EVENT_NAME,
  insertEvent,
  inspectionSyncHub,
  resetInspectionTestDatabase,
} from "./inspection.test-support";

const EVENT_TEAMS = [
  { teamNumber: 111, name: "Alpha" },
  { teamNumber: 222, name: "Bravo" },
] as const;

const readChunk = async (
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> => {
  const result = await reader.read();
  if (result.done || !result.value) {
    throw new Error("Expected an SSE chunk.");
  }

  return new TextDecoder().decode(result.value);
};

describe("inspection route auth and stream", () => {
  beforeEach(async () => {
    await resetInspectionTestDatabase();
  });

  it("enforces inspector and lead-inspector guards", async () => {
    const eventCode = "INAUTH1";
    insertEvent(eventCode);
    createInspectionEventDb(eventCode, [...EVENT_TEAMS]);

    const app = createInspectionTestApp();
    const judgeToken = await createInspectionToken("JUDGE", eventCode);
    const inspectorToken = await createInspectionToken("INSPECTOR", eventCode);

    const unauthenticatedResponse = await app.request(
      `http://localhost/${eventCode}/inspection/checklist`
    );
    expect(unauthenticatedResponse.status).toBe(401);
    expect(await unauthenticatedResponse.json()).toEqual({
      error: "Unauthorized",
    });

    const forbiddenResponse = await app.request(
      `http://localhost/${eventCode}/inspection/teams`,
      { headers: { authorization: `Bearer ${judgeToken}` } }
    );
    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.json()).toEqual({
      error: "Forbidden",
      message: "Inspector access required.",
    });

    const leadOnlyResponse = await app.request(
      `http://localhost/${eventCode}/inspection/teams/111/override`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${inspectorToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ comment: "Override requested." }),
      }
    );
    expect(leadOnlyResponse.status).toBe(403);
    expect(await leadOnlyResponse.json()).toEqual({
      error: "Forbidden",
      message: "Lead Inspector access required.",
    });
  });

  it("streams snapshot hints, heartbeats, and inspection sync updates", async () => {
    const eventCode = "INSTRM1";
    const app = createInspectionTestApp();
    const inspectorToken = await createInspectionToken("INSPECTOR", eventCode);

    jest.useFakeTimers();

    const response = await app.request(
      `http://localhost/${eventCode}/inspection/stream`,
      { headers: { authorization: `Bearer ${inspectorToken}` } }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) {
      jest.useRealTimers();
      return;
    }

    const snapshotChunk = await readChunk(reader);
    expect(snapshotChunk).toContain(`event: ${INSPECTION_SYNC_EVENT_NAME}`);
    expect(snapshotChunk).toContain(`id: ${eventCode}:0`);
    expect(snapshotChunk).toContain('"kind":"SNAPSHOT_HINT"');

    jest.advanceTimersByTime(20_000);
    const heartbeatChunk = await readChunk(reader);
    expect(heartbeatChunk).toContain(": heartbeat");

    inspectionSyncHub.publish({
      eventCode,
      kind: "ITEMS_UPDATED",
      teamNumber: 111,
    });

    const updateChunk = await readChunk(reader);
    expect(updateChunk).toContain(`event: ${INSPECTION_SYNC_EVENT_NAME}`);
    expect(updateChunk).toContain('"kind":"ITEMS_UPDATED"');
    expect(updateChunk).toContain('"teamNumber":111');

    await reader.cancel();
    jest.useRealTimers();
  });
});
