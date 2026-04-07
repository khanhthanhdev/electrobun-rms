import { Database } from "bun:sqlite";
import { beforeEach, describe, expect, it } from "bun:test";
import {
  createAdminToken,
  createEventsTestApp,
  createPrintListsEventDb,
  eventDbExists,
  getEventDbPath,
  insertEvent,
  readStoredEvent,
  resetEventsTestDatabase,
  seedPrintableAccount,
} from "./events.test-support";

const buildExpectedDefaultAccountSummaries = (eventCode: string) => {
  const normalizedEventCode = eventCode.toLowerCase();

  return [
    { username: `${normalizedEventCode}_eventadmin`, role: "ADMIN" },
    { username: `${normalizedEventCode}_tso`, role: "TSO" },
    { username: `${normalizedEventCode}_hr`, role: "HEAD_REFEREE" },
    {
      username: `${normalizedEventCode}_leadinspector`,
      role: "LEAD_INSPECTOR",
    },
    ...Array.from({ length: 5 }, (_, index) => ({
      username: `${normalizedEventCode}_inspector${index + 1}`,
      role: "INSPECTOR",
    })),
    ...Array.from({ length: 3 }, (_, index) => ({
      username: `${normalizedEventCode}_judge${index + 1}`,
      role: "JUDGE",
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      username: `${normalizedEventCode}_referee${index + 1}`,
      role: "REFEREE",
    })),
  ];
};

const sortAccountSummaries = <T extends { role: string; username: string }>(
  accounts: T[]
): T[] =>
  [...accounts].sort(
    (left, right) =>
      left.username.localeCompare(right.username) ||
      left.role.localeCompare(right.role)
  );

describe("events contract routes", () => {
  beforeEach(async () => {
    await resetEventsTestDatabase();
  });

  it("preserves event list, get, and update payloads", async () => {
    const eventCode = "EVCRUD1";
    insertEvent(eventCode);

    const app = createEventsTestApp();
    const token = await createAdminToken();

    const listResponse = await app.request("http://localhost/");
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      events: [
        {
          code: eventCode,
          divisions: 1,
          end: Date.parse("2026-03-24T00:00:00.000Z"),
          fields: 1,
          finals: 1,
          name: `Event ${eventCode}`,
          region: "Test Region",
          start: Date.parse("2026-03-23T00:00:00.000Z"),
          status: 1,
          type: 1,
        },
      ],
    });

    const getResponse = await app.request(`http://localhost/${eventCode}`);
    expect(getResponse.status).toBe(200);
    expect(await getResponse.json()).toEqual({
      event: {
        code: eventCode,
        divisions: 1,
        end: Date.parse("2026-03-24T00:00:00.000Z"),
        fields: 1,
        finals: 1,
        name: `Event ${eventCode}`,
        region: "Test Region",
        start: Date.parse("2026-03-23T00:00:00.000Z"),
        status: 1,
        type: 1,
      },
    });

    const updatePayload = {
      eventName: "Updated Event",
      region: "Updated Region",
      eventType: 2,
      startDate: "2026-04-10T00:00:00.000Z",
      endDate: "2026-04-12T00:00:00.000Z",
      divisions: 3,
      fields: 2,
      finals: 4,
      status: 5,
    };

    const updateResponse = await app.request(`http://localhost/${eventCode}`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    });

    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({
      event: {
        code: eventCode,
        divisions: 3,
        end: Date.parse(updatePayload.endDate),
        fields: 2,
        finals: 4,
        name: "Updated Event",
        region: "Updated Region",
        start: Date.parse(updatePayload.startDate),
        status: 5,
        type: 2,
      },
    });

    expect(readStoredEvent(eventCode)).toEqual({
      code: eventCode,
      divisions: 3,
      end: Date.parse(updatePayload.endDate),
      fields: 2,
      finals: 4,
      name: "Updated Event",
      region: "Updated Region",
      start: Date.parse(updatePayload.startDate),
      status: 5,
      type: 2,
    });
  });

  it("preserves manual event creation payloads and provisioning side effects", async () => {
    const eventCode = "MANUAL1";
    const payload = {
      eventCode,
      eventName: "Manual Event",
      region: "Vietnam",
      eventType: 3,
      startDate: "2026-05-01T00:00:00.000Z",
      endDate: "2026-05-03T00:00:00.000Z",
      divisions: 2,
    };

    const app = createEventsTestApp();
    const token = await createAdminToken();

    const response = await app.request("http://localhost/manual", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      event: {
        code: eventCode,
        divisions: 2,
        end: Date.parse(payload.endDate),
        fields: 1,
        finals: 0,
        name: "Manual Event",
        region: "Vietnam",
        start: Date.parse(payload.startDate),
        status: 1,
        type: 3,
      },
    });

    expect(readStoredEvent(eventCode)).toEqual({
      code: eventCode,
      divisions: 2,
      end: Date.parse(payload.endDate),
      fields: 1,
      finals: 0,
      name: "Manual Event",
      region: "Vietnam",
      start: Date.parse(payload.startDate),
      status: 1,
      type: 3,
    });
    expect(eventDbExists(eventCode)).toBe(true);

    const eventDb = new Database(getEventDbPath(eventCode));
    try {
      const tableRow = eventDb
        .query(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'practice_results' LIMIT 1"
        )
        .get() as { name: string } | null;
      expect(tableRow).toEqual({ name: "practice_results" });
    } finally {
      eventDb.close();
    }
  });

  it("preserves default-account list and regenerate payloads", async () => {
    const eventCode = "ACCNT01";
    insertEvent(eventCode);

    const app = createEventsTestApp();
    const token = await createAdminToken();

    const initialListResponse = await app.request(
      `http://localhost/${eventCode}/default-accounts`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );
    expect(initialListResponse.status).toBe(200);
    expect(await initialListResponse.json()).toEqual({
      eventCode,
      accounts: [],
    });

    const regenerateResponse = await app.request(
      `http://localhost/${eventCode}/default-accounts/regenerate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    const regenerated = await regenerateResponse.json();
    expect(regenerateResponse.status).toBe(200);
    expect(regenerated.eventCode).toBe(eventCode);
    expect(regenerated.accounts).toHaveLength(20);
    expect(
      sortAccountSummaries(
        regenerated.accounts.map(
          (account: { role: string; username: string }) => ({
            username: account.username,
            role: account.role,
          })
        )
      )
    ).toEqual(
      sortAccountSummaries(buildExpectedDefaultAccountSummaries(eventCode))
    );
    expect(
      regenerated.accounts.every(
        (account: { password: string }) => account.password.length === 10
      )
    ).toBe(true);

    const listResponse = await app.request(
      `http://localhost/${eventCode}/default-accounts`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    const listedAccounts = await listResponse.json();
    expect(listResponse.status).toBe(200);
    expect(listedAccounts.eventCode).toBe(eventCode);
    expect(sortAccountSummaries(listedAccounts.accounts)).toEqual(
      sortAccountSummaries(regenerated.accounts)
    );
  });

  it("preserves print-list payloads", async () => {
    const eventCode = "PRINT01";
    insertEvent(eventCode);
    createPrintListsEventDb(eventCode, {
      teams: [
        {
          teamNumber: 111,
          teamNameShort: "Alpha",
          teamNameLong: "Alpha Long",
          city: "Hanoi",
          country: "Vietnam",
        },
        {
          teamNumber: 222,
          teamNameShort: "Bravo",
          city: "Da Nang",
          country: "Vietnam",
        },
      ],
      matches: [
        {
          matchId: "Q1",
          playNumber: 1,
          fieldType: 2,
          redScore: 30,
          blueScore: 25,
          startTime: "2026-05-01T08:00:00.000Z",
        },
      ],
      schedules: [
        {
          tournamentLevel: 2,
          matchNumber: 1,
          description: "Qualification Match 1",
          startTime: "2026-05-01T08:00:00.000Z",
        },
      ],
    });
    seedPrintableAccount(eventCode, {
      username: "print01_admin",
      role: "ADMIN",
      password: "secret-pass",
    });

    const app = createEventsTestApp();
    const token = await createAdminToken();

    const response = await app.request(
      `http://localhost/${eventCode}/print-lists`,
      {
        headers: {
          authorization: `Bearer ${token}`,
        },
      }
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eventCode,
      generatedAt: expect.any(String),
      accounts: [
        {
          username: "print01_admin",
          role: "ADMIN",
          password: "secret-pass",
        },
      ],
      teams: [
        {
          teamNumber: 111,
          name: "Alpha Long",
          location: "Hanoi, Vietnam",
        },
        {
          teamNumber: 222,
          name: "Bravo",
          location: "Da Nang, Vietnam",
        },
      ],
      matches: [
        {
          matchId: "Q1",
          playNumber: 1,
          fieldType: 2,
          redScore: 30,
          blueScore: 25,
          startTime: "2026-05-01T08:00:00.000Z",
        },
      ],
      schedules: [
        {
          stage: "Qualification",
          matchNumber: 1,
          description: "Qualification Match 1",
          startTime: "2026-05-01T08:00:00.000Z",
        },
      ],
    });
  });
});
