import { beforeEach, describe, expect, it } from "bun:test";
import {
  insertEvent,
  resetEventsTestDatabase,
} from "../../../api/events/events.test-support";
import { SQLiteEventRepository } from "./sqlite-event-repository";

describe("SQLiteEventRepository", () => {
  beforeEach(async () => {
    await resetEventsTestDatabase();
  });

  it("preserves list, get, and update persistence behavior", async () => {
    const eventCode = "EVREPO1";
    insertEvent(eventCode);

    const repository = new SQLiteEventRepository();

    expect(await repository.listEvents()).toEqual([
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
    ]);

    expect(await repository.getEvent(eventCode)).toEqual({
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
    });

    expect(
      await repository.updateEvent(eventCode, {
        eventName: "Updated Repository Event",
        region: "Repository Region",
        eventType: 7,
        startDate: "2026-04-01T00:00:00.000Z",
        endDate: "2026-04-02T00:00:00.000Z",
        divisions: 4,
        fields: 3,
        finals: 2,
        status: 6,
      })
    ).toEqual({
      code: eventCode,
      divisions: 4,
      end: Date.parse("2026-04-02T00:00:00.000Z"),
      fields: 3,
      finals: 2,
      name: "Updated Repository Event",
      region: "Repository Region",
      start: Date.parse("2026-04-01T00:00:00.000Z"),
      status: 6,
      type: 7,
    });
  });
});
