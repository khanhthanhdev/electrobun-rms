import { beforeEach, describe, expect, it } from "bun:test";
import checklistConfig from "../../config/inspection-checklist.json";
import {
  createInspectionEventDb,
  createInspectionTestApp,
  createInspectionToken,
  insertEvent,
  inspectionSyncHub,
  resetInspectionTestDatabase,
} from "./inspection.test-support";

const EVENT_TEAMS = [
  { teamNumber: 111, name: "Alpha" },
  { teamNumber: 222, name: "Bravo" },
] as const;

const REQUIRED_ITEM_UPDATES = checklistConfig.items
  .filter((item) => item.required)
  .map((item) => ({ key: item.key, value: "YES" }));

describe("inspection write routes", () => {
  beforeEach(async () => {
    await resetInspectionTestDatabase();
  });

  it("preserves item, status, comment, history, override, and sync behavior", async () => {
    const eventCode = "INWRITE1";
    insertEvent(eventCode);
    createInspectionEventDb(eventCode, [...EVENT_TEAMS]);

    const app = createInspectionTestApp();
    const inspectorToken = await createInspectionToken("INSPECTOR", eventCode);
    const leadToken = await createInspectionToken("LEAD_INSPECTOR", eventCode);
    const syncEvents: Array<{ kind: string; teamNumber: number | null }> = [];
    const unsubscribe = inspectionSyncHub.subscribe(eventCode, (event) => {
      syncEvents.push({ kind: event.kind, teamNumber: event.teamNumber });
    });

    try {
      const partialItemsResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/items`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${inspectorToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ items: REQUIRED_ITEM_UPDATES.slice(0, 2) }),
        }
      );
      expect(partialItemsResponse.status).toBe(200);
      expect(syncEvents).toContainEqual({
        kind: "ITEMS_UPDATED",
        teamNumber: 111,
      });

      const failedPassResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${inspectorToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "PASSED" }),
        }
      );
      expect(failedPassResponse.status).toBe(400);
      expect(await failedPassResponse.json()).toEqual({
        error: "Failed to update inspection status",
        message: expect.stringContaining("required items are not completed"),
      });
      expect(syncEvents).toHaveLength(1);

      const completeItemsResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/items`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${inspectorToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ items: REQUIRED_ITEM_UPDATES }),
        }
      );
      expect(completeItemsResponse.status).toBe(200);

      const passedResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/status`,
        {
          method: "PATCH",
          headers: {
            authorization: `Bearer ${inspectorToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ status: "PASSED" }),
        }
      );
      expect(passedResponse.status).toBe(200);
      expect(syncEvents.at(-1)).toEqual({
        kind: "STATUS_UPDATED",
        teamNumber: 111,
      });

      const commentResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/comment`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${inspectorToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ comment: "Needs one final check." }),
        }
      );
      expect(commentResponse.status).toBe(200);
      expect(await commentResponse.json()).toEqual({ success: true });
      expect(syncEvents.at(-1)).toEqual({
        kind: "COMMENT_UPDATED",
        teamNumber: 111,
      });

      const historyResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/history`,
        { headers: { authorization: `Bearer ${inspectorToken}` } }
      );
      expect(historyResponse.status).toBe(200);
      expect(await historyResponse.json()).toEqual({
        history: [
          expect.objectContaining({
            action: "STATUS_CHANGE",
            changedBy: "inspector",
            isOverride: false,
            newStatus: "PASSED",
            oldStatus: "IN_PROGRESS",
          }),
        ],
        teamNumber: 111,
      });

      const overrideResponse = await app.request(
        `http://localhost/${eventCode}/inspection/teams/111/override`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${leadToken}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ comment: "Lead override approved." }),
        }
      );
      expect(overrideResponse.status).toBe(200);
      expect(await overrideResponse.json()).toEqual(
        expect.objectContaining({
          inspection: expect.objectContaining({
            comment: "Lead override approved.",
            status: "PASSED",
          }),
        })
      );
      expect(syncEvents.at(-1)).toEqual({
        kind: "OVERRIDE_APPLIED",
        teamNumber: 111,
      });

      const publicStatusResponse = await app.request(
        `http://localhost/${eventCode}/inspection/public-status`
      );
      expect(publicStatusResponse.status).toBe(200);
      expect(await publicStatusResponse.json()).toEqual({
        eventCode,
        statusCounts: {
          NOT_STARTED: 1,
          IN_PROGRESS: 0,
          INCOMPLETE: 0,
          PASSED: 1,
        },
        teams: [
          expect.objectContaining({
            status: "PASSED",
            statusCode: "3",
            statusLabel: "Passed",
            teamName: "Alpha",
            teamNumber: 111,
          }),
          expect.objectContaining({
            status: "NOT_STARTED",
            statusCode: "0",
            statusLabel: "Not Started",
            teamName: "Bravo",
            teamNumber: 222,
          }),
        ],
      });
    } finally {
      unsubscribe();
    }
  });
});
