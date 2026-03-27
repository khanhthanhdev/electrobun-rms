import { beforeEach, describe, expect, it } from "bun:test";
import {
  createAdminToken,
  createScheduleEventDb,
  createScheduleTestApp,
  insertEvent,
  resetScheduleTestDatabase,
} from "./schedule.test-support";

const EVENT_TEAMS = [
  { teamNumber: 111, name: "Alpha" },
  { teamNumber: 222, name: "Bravo" },
  { teamNumber: 333, name: "Charlie" },
  { teamNumber: 444, name: "Delta" },
] as const;

const PRACTICE_SAVE_PAYLOAD = {
  startTime: 1_710_000_000_000,
  cycleTimeSeconds: 180,
  matches: [
    { matchNumber: 1, redTeam: 111, blueTeam: 222 },
    { matchNumber: 2, redTeam: 333, blueTeam: 444 },
  ],
} as const;

const PRACTICE_GENERATE_PAYLOAD = {
  matchesPerTeam: 1,
  fieldStartOffsetSeconds: 30,
  matchBlocks: [
    {
      startTime: 1_710_001_000_000,
      endTime: 1_710_001_300_000,
      cycleTimeSeconds: 180,
    },
  ],
} as const;

const QUALS_SAVE_PAYLOAD = {
  startTime: 1_710_002_000_000,
  cycleTimeSeconds: 240,
  fieldCount: 2,
  fieldStartOffsetSeconds: 15,
  matches: [
    { matchNumber: 1, redTeam: 111, blueTeam: 222 },
    { matchNumber: 2, redTeam: 333, blueTeam: 444 },
  ],
} as const;

const QUALS_GENERATE_PAYLOAD = {
  startTime: 1_710_003_000_000,
  cycleTimeSeconds: 240,
  fieldCount: 2,
  fieldStartOffsetSeconds: 15,
  matchesPerTeam: 1,
} as const;

const readTeamsFromMatches = (
  matches: Array<{ blueTeam: number; redTeam: number }>
): number[] => [...matches.flatMap((match) => [match.redTeam, match.blueTeam])];

describe("schedule routes", () => {
  beforeEach(async () => {
    await resetScheduleTestDatabase();
  });

  it("rejects unauthenticated schedule writes", async () => {
    const eventCode = "SCAUTH1";
    insertEvent(eventCode);
    createScheduleEventDb(eventCode, [...EVENT_TEAMS]);

    const app = createScheduleTestApp();

    const practiceResponse = await app.request(
      `http://localhost/${eventCode}/schedule/practice`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(PRACTICE_SAVE_PAYLOAD),
      }
    );
    expect(practiceResponse.status).toBe(401);
    expect(await practiceResponse.json()).toEqual({ error: "Unauthorized" });

    const qualsResponse = await app.request(
      `http://localhost/${eventCode}/schedule/quals/generate`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(QUALS_GENERATE_PAYLOAD),
      }
    );
    expect(qualsResponse.status).toBe(401);
    expect(await qualsResponse.json()).toEqual({ error: "Unauthorized" });
  });

  it("preserves the practice schedule route surface", async () => {
    const eventCode = "SCPRAC1";
    insertEvent(eventCode);
    createScheduleEventDb(eventCode, [...EVENT_TEAMS]);

    const app = createScheduleTestApp();
    const token = await createAdminToken(eventCode);

    const initialResponse = await app.request(
      `http://localhost/${eventCode}/schedule/practice`
    );
    expect(initialResponse.status).toBe(200);
    expect(await initialResponse.json()).toEqual({
      eventCode,
      isActive: false,
      matches: [],
      config: {
        startTime: null,
        cycleTimeSeconds: 180,
        matchTimeSeconds: 150,
        fieldStartOffsetSeconds: 0,
        fieldCount: 2,
      },
    });

    const saveResponse = await app.request(
      `http://localhost/${eventCode}/schedule/practice`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(PRACTICE_SAVE_PAYLOAD),
      }
    );
    expect(saveResponse.status).toBe(200);
    expect(await saveResponse.json()).toEqual({
      eventCode,
      isActive: false,
      matches: [
        {
          matchNumber: 1,
          redTeam: 111,
          redSurrogate: false,
          blueTeam: 222,
          blueSurrogate: false,
          startTime: 1_710_000_000_000,
          endTime: 1_710_000_150_000,
        },
        {
          matchNumber: 2,
          redTeam: 333,
          redSurrogate: false,
          blueTeam: 444,
          blueSurrogate: false,
          startTime: 1_710_000_000_000,
          endTime: 1_710_000_150_000,
        },
      ],
      config: {
        startTime: 1_710_000_000_000,
        cycleTimeSeconds: 180,
        matchTimeSeconds: 150,
        fieldStartOffsetSeconds: 0,
        fieldCount: 2,
      },
    });

    const generateResponse = await app.request(
      `http://localhost/${eventCode}/schedule/practice/generate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(PRACTICE_GENERATE_PAYLOAD),
      }
    );
    const generatedPractice = await generateResponse.json();
    expect(generateResponse.status).toBe(201);
    expect(generatedPractice.eventCode).toBe(eventCode);
    expect(generatedPractice.isActive).toBe(false);
    expect(generatedPractice.matches).toHaveLength(2);
    expect(
      readTeamsFromMatches(generatedPractice.matches).sort((a, b) => a - b)
    ).toEqual([111, 222, 333, 444]);
    expect(generatedPractice.config).toEqual({
      startTime: PRACTICE_GENERATE_PAYLOAD.matchBlocks[0].startTime,
      cycleTimeSeconds: 180,
      matchTimeSeconds: 150,
      fieldStartOffsetSeconds: 30,
      fieldCount: 2,
    });

    const activateResponse = await app.request(
      `http://localhost/${eventCode}/schedule/practice/active`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ active: true }),
      }
    );
    expect(activateResponse.status).toBe(200);
    expect((await activateResponse.json()).isActive).toBe(true);

    const clearResponse = await app.request(
      `http://localhost/${eventCode}/schedule/practice`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    expect(clearResponse.status).toBe(200);
    expect(await clearResponse.json()).toEqual({
      eventCode,
      isActive: false,
      matches: [],
      config: {
        startTime: null,
        cycleTimeSeconds: 180,
        matchTimeSeconds: 150,
        fieldStartOffsetSeconds: 0,
        fieldCount: 2,
      },
    });
  });

  it("preserves the qualification schedule route surface", async () => {
    const eventCode = "SCQUAL1";
    insertEvent(eventCode);
    createScheduleEventDb(eventCode, [...EVENT_TEAMS]);

    const app = createScheduleTestApp();
    const token = await createAdminToken(eventCode);

    const initialResponse = await app.request(
      `http://localhost/${eventCode}/schedule/quals`
    );
    expect(initialResponse.status).toBe(200);
    expect(await initialResponse.json()).toEqual({
      eventCode,
      isActive: false,
      matches: [],
      metrics: {
        averageSideImbalance: 0,
        backToBackCount: 0,
        maxOpponentRepeat: 0,
        maxSideImbalance: 0,
        repeatOpponentPairs: 0,
        surrogateSlots: 0,
      },
      config: {
        startTime: null,
        cycleTimeSeconds: 240,
        fieldStartOffsetSeconds: 15,
        matchTimeSeconds: 150,
        fieldCount: 2,
        matchesPerTeam: 6,
      },
    });

    const saveResponse = await app.request(
      `http://localhost/${eventCode}/schedule/quals`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(QUALS_SAVE_PAYLOAD),
      }
    );
    expect(saveResponse.status).toBe(200);
    expect(await saveResponse.json()).toEqual({
      eventCode,
      isActive: false,
      matches: [
        {
          matchNumber: 1,
          redTeam: 111,
          redSurrogate: false,
          blueTeam: 222,
          blueSurrogate: false,
          startTime: 1_710_002_000_000,
          endTime: 1_710_002_150_000,
        },
        {
          matchNumber: 2,
          redTeam: 333,
          redSurrogate: false,
          blueTeam: 444,
          blueSurrogate: false,
          startTime: 1_710_002_015_000,
          endTime: 1_710_002_165_000,
        },
      ],
      metrics: {
        averageSideImbalance: 1,
        backToBackCount: 0,
        maxOpponentRepeat: 1,
        maxSideImbalance: 1,
        repeatOpponentPairs: 0,
        surrogateSlots: 0,
      },
      config: {
        startTime: 1_710_002_000_000,
        cycleTimeSeconds: 240,
        fieldStartOffsetSeconds: 15,
        matchTimeSeconds: 150,
        fieldCount: 2,
        matchesPerTeam: 1,
      },
    });

    const generateResponse = await app.request(
      `http://localhost/${eventCode}/schedule/quals/generate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(QUALS_GENERATE_PAYLOAD),
      }
    );
    const generatedQuals = await generateResponse.json();
    expect(generateResponse.status).toBe(201);
    expect(generatedQuals.eventCode).toBe(eventCode);
    expect(generatedQuals.isActive).toBe(false);
    expect(generatedQuals.matches).toHaveLength(2);
    expect(
      readTeamsFromMatches(generatedQuals.matches).sort((a, b) => a - b)
    ).toEqual([111, 222, 333, 444]);
    expect(generatedQuals.metrics).toEqual({
      averageSideImbalance: 1,
      backToBackCount: 0,
      maxOpponentRepeat: 1,
      maxSideImbalance: 1,
      repeatOpponentPairs: 0,
      surrogateSlots: 0,
    });

    const activateResponse = await app.request(
      `http://localhost/${eventCode}/schedule/quals/active`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ active: true }),
      }
    );
    expect(activateResponse.status).toBe(200);
    expect((await activateResponse.json()).isActive).toBe(true);

    const clearResponse = await app.request(
      `http://localhost/${eventCode}/schedule/quals`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    expect(clearResponse.status).toBe(200);
    expect(await clearResponse.json()).toEqual({
      eventCode,
      isActive: false,
      matches: [],
      metrics: {
        averageSideImbalance: 0,
        backToBackCount: 0,
        maxOpponentRepeat: 0,
        maxSideImbalance: 0,
        repeatOpponentPairs: 0,
        surrogateSlots: 0,
      },
      config: {
        startTime: null,
        cycleTimeSeconds: 240,
        fieldStartOffsetSeconds: 15,
        matchTimeSeconds: 150,
        fieldCount: 2,
        matchesPerTeam: 1,
      },
    });
  });
});
