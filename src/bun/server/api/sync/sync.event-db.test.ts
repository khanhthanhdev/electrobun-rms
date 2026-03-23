import { beforeEach, describe, expect, it } from "bun:test";
import {
  applySyncChangeSetsToEventDb,
  createEventDb,
  openEventDb,
  resetSyncTestDatabase,
} from "./sync.test-support";

const EVENT_CODE = "SYNCDB";

describe("applySyncChangeSetsToEventDb", () => {
  beforeEach(async () => {
    await resetSyncTestDatabase();
    createEventDb(EVENT_CODE);
  });

  it("upserts inspection results and records history", () => {
    applySyncChangeSetsToEventDb(EVENT_CODE, [
      {
        mode: "upsert",
        records: [
          {
            comment: "Passed at station 1",
            recordedAt: "2026-03-23T10:00:00.000Z",
            stage: "GENERAL",
            status: "PASSED",
            teamNumber: "123",
          },
        ],
        resourceType: "inspection_results",
      },
    ]);

    const eventDb = openEventDb(EVENT_CODE);
    try {
      const inspection = eventDb
        .query(
          `SELECT
            status AS status,
            comment AS comment,
            finalized_at AS finalizedAt
           FROM inspections
           WHERE team_number = ?`
        )
        .get(123) as {
        comment: string | null;
        finalizedAt: number | null;
        status: string;
      } | null;

      const historyRow = eventDb
        .query(
          "SELECT COUNT(*) AS count FROM inspection_history WHERE team_number = ?"
        )
        .get(123) as { count: number };

      expect(inspection?.status).toBe("PASSED");
      expect(inspection?.comment).toBe("Passed at station 1");
      expect(inspection?.finalizedAt).not.toBeNull();
      expect(historyRow.count).toBe(1);
    } finally {
      eventDb.close();
    }
  });

  it("rolls back earlier writes when a later change set fails", () => {
    expect(() =>
      applySyncChangeSetsToEventDb(EVENT_CODE, [
        {
          mode: "upsert",
          records: [
            {
              recordedAt: "2026-03-23T10:00:00.000Z",
              stage: "GENERAL",
              status: "PASSED",
              teamNumber: "123",
            },
          ],
          resourceType: "inspection_results",
        },
        {
          mode: "replace_snapshot",
          records: [
            {
              alliances: [{ color: "RED", teamNumbers: ["123"] }],
              matchKey: "Q1",
              matchNumber: 1,
              phase: "QUALIFICATION",
              status: "SCHEDULED",
            },
          ],
          resourceType: "match_schedule",
        },
      ])
    ).toThrow("Match records require one RED and one BLUE alliance.");

    const eventDb = openEventDb(EVENT_CODE);
    try {
      const inspectionsTable = eventDb
        .query(
          "SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = 'inspections' LIMIT 1"
        )
        .get() as { present: number } | null;

      if (!inspectionsTable) {
        expect(inspectionsTable).toBeNull();
        return;
      }

      const inspectionCount = eventDb
        .query("SELECT COUNT(*) AS count FROM inspections")
        .get() as { count: number };

      expect(inspectionCount.count).toBe(0);
    } finally {
      eventDb.close();
    }
  });
});
