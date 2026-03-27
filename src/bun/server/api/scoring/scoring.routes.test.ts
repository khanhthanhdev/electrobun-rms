import { beforeEach, describe, expect, it, jest } from "bun:test";
import {
  createAdminToken,
  createScoringEventDb,
  createScoringTestApp,
  insertEvent,
  resetScoringTestDatabase,
  SCORING_SYNC_EVENT_NAME,
  scoringSyncHub,
} from "./scoring.test-support";

const RED_SCORE_PAYLOAD = {
  matchType: "quals",
  matchNumber: 1,
  alliance: "red",
  aSecondTierFlags: 1,
  aFirstTierFlags: 2,
  aCenterFlags: 3,
  bCenterFlagDown: 1,
  bBaseFlagsDown: 2,
  cOpponentBackfieldBullets: 4,
  dRobotParkState: 2,
  dGoldFlagsDefended: 3,
} as const;

const BLUE_SCORE_PAYLOAD = {
  matchType: "quals",
  matchNumber: 1,
  alliance: "blue",
  aSecondTierFlags: 0,
  aFirstTierFlags: 1,
  aCenterFlags: 1,
  bCenterFlagDown: 0,
  bBaseFlagsDown: 1,
  cOpponentBackfieldBullets: 1,
  dRobotParkState: 1,
  dGoldFlagsDefended: 0,
} as const;

const readChunk = async (
  reader: ReadableStreamDefaultReader<Uint8Array>
): Promise<string> => {
  const result = await reader.read();
  if (result.done || !result.value) {
    throw new Error("Expected an SSE chunk.");
  }

  return new TextDecoder().decode(result.value);
};

describe("scoring routes", () => {
  beforeEach(async () => {
    await resetScoringTestDatabase();
  });

  it("rejects unauthenticated score writes", async () => {
    const eventCode = "SCAUTH1";
    insertEvent(eventCode);
    createScoringEventDb(eventCode);

    const app = createScoringTestApp();
    const response = await app.request(
      `http://localhost/${eventCode}/scoring/matches`,
      {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(RED_SCORE_PAYLOAD),
      }
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("rejects invalid scoring route params before repository access", async () => {
    const app = createScoringTestApp();

    const invalidTypeResponse = await app.request(
      "http://localhost/SCPARAM1/scoring/bad/results"
    );
    expect(invalidTypeResponse.status).toBe(400);
    expect(await invalidTypeResponse.json()).toEqual({
      error: "Invalid match type",
    });

    const invalidMatchNumberResponse = await app.request(
      "http://localhost/SCPARAM1/scoring/quals/0"
    );
    expect(invalidMatchNumberResponse.status).toBe(400);
    expect(await invalidMatchNumberResponse.json()).toEqual({
      error: "Invalid match number",
    });
  });

  it("streams snapshot hints and published score updates", async () => {
    const eventCode = "SCSTRM1";
    const app = createScoringTestApp();

    jest.useFakeTimers();

    const response = await app.request(
      `http://localhost/${eventCode}/scoring/stream`
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const reader = response.body?.getReader();
    expect(reader).toBeDefined();
    if (!reader) {
      return;
    }

    const snapshotChunk = await readChunk(reader);
    expect(snapshotChunk).toContain(`event: ${SCORING_SYNC_EVENT_NAME}`);
    expect(snapshotChunk).toContain(`id: ${eventCode}:0`);
    expect(snapshotChunk).toContain('"kind":"SNAPSHOT_HINT"');

    jest.advanceTimersByTime(20_000);
    const heartbeatChunk = await readChunk(reader);
    expect(heartbeatChunk).toContain(": heartbeat");

    scoringSyncHub.publish({
      eventCode,
      kind: "SCORE_UPDATED",
      matchNumber: 1,
      matchType: "quals",
    });

    const updateChunk = await readChunk(reader);
    expect(updateChunk).toContain(`event: ${SCORING_SYNC_EVENT_NAME}`);
    expect(updateChunk).toContain(`id: ${eventCode}:1`);
    expect(updateChunk).toContain('"kind":"SCORE_UPDATED"');
    expect(updateChunk).toContain('"matchType":"quals"');

    await reader.cancel();
    jest.useRealTimers();
  });

  it("preserves the scoring read and write payloads through the new scoring path", async () => {
    const eventCode = "SCFLOW1";
    insertEvent(eventCode);
    createScoringEventDb(eventCode, {
      bluePenaltyCommitted: 7,
      blueScore: 12,
      redPenaltyCommitted: 5,
      redScore: 0,
    });

    const token = await createAdminToken(eventCode);
    const app = createScoringTestApp();

    const initialScoresheetResponse = await app.request(
      `http://localhost/${eventCode}/scoring/quals/1`
    );
    expect(initialScoresheetResponse.status).toBe(200);
    expect(await initialScoresheetResponse.json()).toEqual({
      red: {
        ts: 0,
        alliance: "red",
        aSecondTierFlags: 0,
        aFirstTierFlags: 0,
        aCenterFlags: 0,
        bCenterFlagDown: 0,
        bBaseFlagsDown: 0,
        cOpponentBackfieldBullets: 0,
        dRobotParkState: 0,
        dGoldFlagsDefended: 0,
        scoreA: 0,
        scoreB: 0,
        scoreC: 0,
        scoreD: 0,
        scoreTotal: 0,
      },
      blue: {
        ts: 0,
        alliance: "blue",
        aSecondTierFlags: 0,
        aFirstTierFlags: 0,
        aCenterFlags: 0,
        bCenterFlagDown: 0,
        bBaseFlagsDown: 0,
        cOpponentBackfieldBullets: 0,
        dRobotParkState: 0,
        dGoldFlagsDefended: 0,
        scoreA: 0,
        scoreB: 0,
        scoreC: 0,
        scoreD: 0,
        scoreTotal: 0,
      },
    });

    const saveRedResponse = await app.request(
      `http://localhost/${eventCode}/scoring/matches`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(RED_SCORE_PAYLOAD),
      }
    );
    expect(saveRedResponse.status).toBe(200);
    expect(await saveRedResponse.json()).toEqual({
      eventCode,
      matchType: "quals",
      matchNumber: 1,
      alliance: "red",
      gameSpecific: {
        aSecondTierFlags: 1,
        aFirstTierFlags: 2,
        aCenterFlags: 3,
        bCenterFlagDown: 1,
        bBaseFlagsDown: 2,
        cOpponentBackfieldBullets: 4,
        dRobotParkState: 2,
        dGoldFlagsDefended: 3,
        scoreA: 95,
        scoreB: 50,
        scoreC: 4,
        scoreD: 45,
        scoreTotal: 194,
      },
      result: {
        redScore: 194,
        blueScore: 12,
        redPenaltyCommitted: 5,
        bluePenaltyCommitted: 7,
      },
    });

    const resultsAfterRedResponse = await app.request(
      `http://localhost/${eventCode}/scoring/quals/results`
    );
    expect(resultsAfterRedResponse.status).toBe(200);
    expect(await resultsAfterRedResponse.json()).toEqual([
      {
        matchNumber: 1,
        redTeam: 111,
        redTeamName: "Team 111",
        blueTeam: 222,
        blueTeamName: "Team 222",
        redSurrogate: false,
        blueSurrogate: false,
        redScore: 194,
        blueScore: null,
      },
    ]);

    const saveBlueResponse = await app.request(
      `http://localhost/${eventCode}/scoring/matches`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(BLUE_SCORE_PAYLOAD),
      }
    );
    expect(saveBlueResponse.status).toBe(200);
    expect(await saveBlueResponse.json()).toEqual({
      eventCode,
      matchType: "quals",
      matchNumber: 1,
      alliance: "blue",
      gameSpecific: {
        aSecondTierFlags: 0,
        aFirstTierFlags: 1,
        aCenterFlags: 1,
        bCenterFlagDown: 0,
        bBaseFlagsDown: 1,
        cOpponentBackfieldBullets: 1,
        dRobotParkState: 1,
        dGoldFlagsDefended: 0,
        scoreA: 30,
        scoreB: 10,
        scoreC: 1,
        scoreD: 10,
        scoreTotal: 51,
      },
      result: {
        redScore: 194,
        blueScore: 51,
        redPenaltyCommitted: 5,
        bluePenaltyCommitted: 7,
      },
    });

    const historyResponse = await app.request(
      `http://localhost/${eventCode}/scoring/quals/1/history`
    );
    expect(historyResponse.status).toBe(200);
    const history = (await historyResponse.json()) as Array<{
      blueScore: number | null;
      redScore: number | null;
      scoresheetAlliance: string;
      ts: number;
      type: string;
    }>;
    expect(history).toHaveLength(2);
    expect(history[0]).toMatchObject({
      type: "Blue Ref Save",
      redScore: 194,
      blueScore: 51,
      scoresheetAlliance: "blue",
    });
    expect(history[1]).toMatchObject({
      type: "Red Ref Save",
      redScore: 194,
      blueScore: null,
      scoresheetAlliance: "red",
    });
    expect(history[0]?.ts).toBeGreaterThanOrEqual(history[1]?.ts ?? 0);

    const finalScoresheetResponse = await app.request(
      `http://localhost/${eventCode}/scoring/quals/1`
    );
    expect(finalScoresheetResponse.status).toBe(200);
    const finalScoresheet = (await finalScoresheetResponse.json()) as {
      blue: Record<string, unknown>;
      red: Record<string, unknown>;
    };
    expect(finalScoresheet.red).toMatchObject({
      alliance: "red",
      aSecondTierFlags: 1,
      aFirstTierFlags: 2,
      aCenterFlags: 3,
      bCenterFlagDown: 1,
      bBaseFlagsDown: 2,
      cOpponentBackfieldBullets: 4,
      dRobotParkState: 2,
      dGoldFlagsDefended: 3,
      scoreA: 95,
      scoreB: 50,
      scoreC: 4,
      scoreD: 45,
      scoreTotal: 194,
    });
    expect(finalScoresheet.blue).toMatchObject({
      alliance: "blue",
      aSecondTierFlags: 0,
      aFirstTierFlags: 1,
      aCenterFlags: 1,
      bCenterFlagDown: 0,
      bBaseFlagsDown: 1,
      cOpponentBackfieldBullets: 1,
      dRobotParkState: 1,
      dGoldFlagsDefended: 0,
      scoreA: 30,
      scoreB: 10,
      scoreC: 1,
      scoreD: 10,
      scoreTotal: 51,
    });
    expect(typeof finalScoresheet.red.ts).toBe("number");
    expect(typeof finalScoresheet.blue.ts).toBe("number");
    expect((finalScoresheet.red.ts as number) > 0).toBe(true);
    expect((finalScoresheet.blue.ts as number) > 0).toBe(true);
  });
});
