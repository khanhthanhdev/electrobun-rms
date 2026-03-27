import { beforeEach, describe, expect, it, jest } from "bun:test";
import {
  createAdminToken,
  createEventsTestApp,
  createRankingEventDb,
  insertEvent,
  QUALIFICATION_RANKINGS_SYNC_EVENT_NAME,
  qualificationRankingsSyncHub,
  resetEventsTestDatabase,
} from "./events.test-support";

const TEST_TEAMS = [
  { teamNumber: 111, name: "Alpha" },
  { teamNumber: 222, name: "Bravo" },
  { teamNumber: 333, name: "Charlie" },
  { teamNumber: 444, name: "Delta" },
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

describe("events ranking routes", () => {
  beforeEach(async () => {
    await resetEventsTestDatabase();
  });

  it("rejects unauthenticated ranking rebuilds", async () => {
    const eventCode = "RKAUTH1";
    insertEvent(eventCode);
    createRankingEventDb(eventCode, { teams: [...TEST_TEAMS] });

    const app = createEventsTestApp();
    const response = await app.request(
      `http://localhost/${eventCode}/qualification-rankings/rebuild`,
      { method: "POST" }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("streams snapshot hints and published ranking updates", async () => {
    const eventCode = "RKSTRM1";
    const app = createEventsTestApp();

    jest.useFakeTimers();

    const response = await app.request(
      `http://localhost/${eventCode}/qualification-rankings/stream`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) {
      return;
    }

    const snapshotChunk = await readChunk(reader);
    expect(snapshotChunk).toContain(
      `event: ${QUALIFICATION_RANKINGS_SYNC_EVENT_NAME}`
    );
    expect(snapshotChunk).toContain(`id: ${eventCode}:0`);
    expect(snapshotChunk).toContain('"kind":"SNAPSHOT_HINT"');

    jest.advanceTimersByTime(20_000);
    const heartbeatChunk = await readChunk(reader);
    expect(heartbeatChunk).toContain(": heartbeat");

    qualificationRankingsSyncHub.publish({
      eventCode,
      kind: "RANKINGS_UPDATED",
    });

    const updateChunk = await readChunk(reader);
    expect(updateChunk).toContain(
      `event: ${QUALIFICATION_RANKINGS_SYNC_EVENT_NAME}`
    );
    expect(updateChunk).toContain(`id: ${eventCode}:1`);
    expect(updateChunk).toContain('"kind":"RANKINGS_UPDATED"');

    await reader.cancel();
    jest.useRealTimers();
  });

  it("preserves ranking rebuild and read payloads through the events route surface", async () => {
    const eventCode = "RKFLOW1";
    insertEvent(eventCode);
    createRankingEventDb(eventCode, {
      teams: [...TEST_TEAMS],
      matches: [
        {
          matchNumber: 1,
          redTeam: 111,
          blueTeam: 222,
          redScore: 100,
          blueScore: 90,
        },
        {
          matchNumber: 2,
          redTeam: 333,
          blueTeam: 444,
          redScore: 50,
          blueScore: 50,
        },
      ],
    });

    const app = createEventsTestApp();
    const token = await createAdminToken(eventCode);
    const publishedEvents: string[] = [];
    const unsubscribe = qualificationRankingsSyncHub.subscribe(
      eventCode,
      (event) => {
        publishedEvents.push(event.kind);
      }
    );

    const initialReadResponse = await app.request(
      `http://localhost/${eventCode}/qualification-rankings`
    );
    expect(initialReadResponse.status).toBe(200);
    expect(await initialReadResponse.json()).toEqual({
      eventCode,
      rankings: [],
    });

    const rebuildResponse = await app.request(
      `http://localhost/${eventCode}/qualification-rankings/rebuild`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    expect(rebuildResponse.status).toBe(200);
    expect(await rebuildResponse.json()).toEqual({
      eventCode,
      rankings: [
        {
          rank: 1,
          teamNumber: 111,
          name: "Alpha",
          rankingPoint: 2,
          total: 100,
          wins: 1,
          losses: 0,
          ties: 0,
          played: 1,
        },
        {
          rank: 2,
          teamNumber: 333,
          name: "Charlie",
          rankingPoint: 1,
          total: 50,
          wins: 0,
          losses: 0,
          ties: 1,
          played: 1,
        },
        {
          rank: 3,
          teamNumber: 444,
          name: "Delta",
          rankingPoint: 1,
          total: 50,
          wins: 0,
          losses: 0,
          ties: 1,
          played: 1,
        },
        {
          rank: 4,
          teamNumber: 222,
          name: "Bravo",
          rankingPoint: 0,
          total: 90,
          wins: 0,
          losses: 1,
          ties: 0,
          played: 1,
        },
      ],
    });

    const readResponse = await app.request(
      `http://localhost/${eventCode}/qualification-rankings`
    );
    expect(readResponse.status).toBe(200);
    expect(await readResponse.json()).toEqual({
      eventCode,
      rankings: [
        {
          rank: 1,
          teamNumber: 111,
          name: "Alpha",
          rankingPoint: 2,
          total: 100,
          wins: 1,
          losses: 0,
          ties: 0,
          played: 1,
        },
        {
          rank: 2,
          teamNumber: 333,
          name: "Charlie",
          rankingPoint: 1,
          total: 50,
          wins: 0,
          losses: 0,
          ties: 1,
          played: 1,
        },
        {
          rank: 3,
          teamNumber: 444,
          name: "Delta",
          rankingPoint: 1,
          total: 50,
          wins: 0,
          losses: 0,
          ties: 1,
          played: 1,
        },
        {
          rank: 4,
          teamNumber: 222,
          name: "Bravo",
          rankingPoint: 0,
          total: 90,
          wins: 0,
          losses: 1,
          ties: 0,
          played: 1,
        },
      ],
    });

    unsubscribe();
    expect(publishedEvents).toContain("RANKINGS_UPDATED");
  });
});
