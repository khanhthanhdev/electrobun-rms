import { beforeEach, describe, expect, it } from "bun:test";
import checklistConfig from "../../config/inspection-checklist.json";
import {
  createInspectionEventDb,
  createInspectionTestApp,
  createInspectionToken,
  insertEvent,
  resetInspectionTestDatabase,
} from "./inspection.test-support";

const EVENT_TEAMS = [
  { teamNumber: 111, name: "Alpha" },
  { teamNumber: 222, name: "Bravo" },
] as const;

const REQUIRED_ITEM_COUNT = checklistConfig.items.filter(
  (item) => item.required
).length;

describe("inspection read routes", () => {
  beforeEach(async () => {
    await resetInspectionTestDatabase();
  });

  it("preserves checklist, team list, detail, and public-status payloads", async () => {
    const eventCode = "INREAD1";
    insertEvent(eventCode);
    createInspectionEventDb(eventCode, [...EVENT_TEAMS]);

    const app = createInspectionTestApp();
    const inspectorToken = await createInspectionToken("INSPECTOR", eventCode);

    const checklistResponse = await app.request(
      `http://localhost/${eventCode}/inspection/checklist`,
      { headers: { authorization: `Bearer ${inspectorToken}` } }
    );
    expect(checklistResponse.status).toBe(200);
    expect(await checklistResponse.json()).toEqual({
      items: checklistConfig.items,
      sections: checklistConfig.sections,
    });

    const listResponse = await app.request(
      `http://localhost/${eventCode}/inspection/teams?search=alp`,
      { headers: { authorization: `Bearer ${inspectorToken}` } }
    );
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      eventCode,
      statusCounts: {
        NOT_STARTED: 1,
        IN_PROGRESS: 0,
        INCOMPLETE: 0,
        PASSED: 0,
      },
      teams: [
        expect.objectContaining({
          comment: null,
          status: "NOT_STARTED",
          statusCode: "0",
          statusLabel: "Not Started",
          teamName: "Alpha",
          teamNumber: 111,
          updatedAt: null,
        }),
      ],
      totalTeams: 2,
    });

    const detailResponse = await app.request(
      `http://localhost/${eventCode}/inspection/teams/111`,
      { headers: { authorization: `Bearer ${inspectorToken}` } }
    );
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toEqual({
      checklist: {
        items: checklistConfig.items,
        sections: checklistConfig.sections,
      },
      inspection: expect.objectContaining({
        comment: null,
        finalizedAt: null,
        id: "111",
        startedAt: null,
        status: "NOT_STARTED",
        statusCode: "0",
        statusLabel: "Not Started",
        updatedAt: null,
      }),
      progress: {
        completedRequired: 0,
        missingRequired: REQUIRED_ITEM_COUNT,
        totalRequired: REQUIRED_ITEM_COUNT,
      },
      responses: {},
      team: {
        teamName: "Alpha",
        teamNumber: 111,
      },
    });

    const publicStatusResponse = await app.request(
      `http://localhost/${eventCode}/inspection/public-status`
    );
    expect(publicStatusResponse.status).toBe(200);
    expect(await publicStatusResponse.json()).toEqual({
      eventCode,
      statusCounts: {
        NOT_STARTED: 2,
        IN_PROGRESS: 0,
        INCOMPLETE: 0,
        PASSED: 0,
      },
      teams: [
        expect.objectContaining({
          status: "NOT_STARTED",
          statusCode: "0",
          statusLabel: "Not Started",
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
  });
});
