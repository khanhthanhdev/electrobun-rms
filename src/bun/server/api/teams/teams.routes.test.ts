import { beforeEach, describe, expect, it } from "bun:test";
import {
  createAdminToken,
  createTeamsEventDb,
  createTeamsTestApp,
  insertEvent,
  readStoredTeamSnapshot,
  resetTeamsTestDatabase,
} from "./teams.test-support";

describe("teams routes", () => {
  beforeEach(async () => {
    await resetTeamsTestDatabase();
  });

  it("preserves list and search semantics across modern and legacy sources", async () => {
    const eventCode = "TEAMGET1";
    insertEvent(eventCode);
    createTeamsEventDb(eventCode, {
      teamsRows: [
        { teamNumber: 111, advancement: 2, division: 1 },
        { teamNumber: 333, advancement: 0, division: 2 },
      ],
      metadataTeams: [
        {
          teamNumber: 111,
          teamName: "Alpha Prime",
          organizationSchool: "East Academy",
          city: "Hanoi",
          country: "Vietnam",
        },
        {
          teamNumber: 444,
          teamName: "Delta Only",
          organizationSchool: "Delta School",
          city: "Da Nang",
          country: "Vietnam",
        },
      ],
      legacyTeams: [
        {
          teamNumber: 111,
          teamNameShort: "Alpha Legacy",
          teamNameLong: "Alpha Legacy Long",
          organizationSchool: "Legacy Academy",
          city: "Hue",
          country: "VN",
        },
        {
          teamNumber: 222,
          teamNameShort: "Bravo Short",
          teamNameLong: null,
          organizationSchool: "Legacy Org",
          city: "Hue",
          country: "Vietnam",
        },
      ],
    });

    const app = createTeamsTestApp();

    const response = await app.request(`http://localhost/${eventCode}/teams`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      eventCode,
      teams: [
        {
          teamNumber: 111,
          teamName: "Alpha Prime",
          organizationSchool: "East Academy",
          city: "Hanoi",
          country: "Vietnam",
          advancement: 2,
          division: 1,
        },
        {
          teamNumber: 222,
          teamName: "Bravo Short",
          organizationSchool: "Legacy Org",
          city: "Hue",
          country: "Vietnam",
          advancement: 0,
          division: 1,
        },
        {
          teamNumber: 333,
          teamName: "Team 333",
          organizationSchool: "",
          city: "",
          country: "",
          advancement: 0,
          division: 2,
        },
        {
          teamNumber: 444,
          teamName: "Delta Only",
          organizationSchool: "Delta School",
          city: "Da Nang",
          country: "Vietnam",
          advancement: 0,
          division: 1,
        },
      ],
    });

    const searchByNumber = await app.request(
      `http://localhost/${eventCode}/teams?search=222`
    );
    expect(searchByNumber.status).toBe(200);
    expect(await searchByNumber.json()).toEqual({
      eventCode,
      teams: [
        {
          teamNumber: 222,
          teamName: "Bravo Short",
          organizationSchool: "Legacy Org",
          city: "Hue",
          country: "Vietnam",
          advancement: 0,
          division: 1,
        },
      ],
    });

    const searchByMetadata = await app.request(
      `http://localhost/${eventCode}/teams?search=delta school`
    );
    expect(searchByMetadata.status).toBe(200);
    expect(await searchByMetadata.json()).toEqual({
      eventCode,
      teams: [
        {
          teamNumber: 444,
          teamName: "Delta Only",
          organizationSchool: "Delta School",
          city: "Da Nang",
          country: "Vietnam",
          advancement: 0,
          division: 1,
        },
      ],
    });
  });

  it("preserves create behavior including auth and duplicate-number upserts", async () => {
    const eventCode = "TEAMPOST1";
    insertEvent(eventCode);
    createTeamsEventDb(eventCode);

    const app = createTeamsTestApp();
    const token = await createAdminToken(eventCode);

    const unauthorizedResponse = await app.request(
      `http://localhost/${eventCode}/teams`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamNumber: 555,
          teamName: "New Team",
        }),
      }
    );
    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({
      error: "Unauthorized",
    });

    const createResponse = await app.request(
      `http://localhost/${eventCode}/teams`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          teamNumber: 555,
          teamName: "New Team",
          organizationSchool: "Org 555",
          city: "Ho Chi Minh City",
          country: "Vietnam",
        }),
      }
    );
    expect(createResponse.status).toBe(201);
    expect(await createResponse.json()).toEqual({
      team: {
        teamNumber: 555,
        teamName: "New Team",
        organizationSchool: "Org 555",
        city: "Ho Chi Minh City",
        country: "Vietnam",
        advancement: 0,
        division: 1,
      },
    });

    const duplicateCreateResponse = await app.request(
      `http://localhost/${eventCode}/teams`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          teamNumber: 555,
          teamName: "Updated Team",
          organizationSchool: "Updated Org",
          city: "Da Nang",
          country: "VN",
        }),
      }
    );
    expect(duplicateCreateResponse.status).toBe(201);
    expect(await duplicateCreateResponse.json()).toEqual({
      team: {
        teamNumber: 555,
        teamName: "Updated Team",
        organizationSchool: "Updated Org",
        city: "Da Nang",
        country: "VN",
        advancement: 0,
        division: 1,
      },
    });

    const listResponse = await app.request(
      `http://localhost/${eventCode}/teams?search=updated org`
    );
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      eventCode,
      teams: [
        {
          teamNumber: 555,
          teamName: "Updated Team",
          organizationSchool: "Updated Org",
          city: "Da Nang",
          country: "VN",
          advancement: 0,
          division: 1,
        },
      ],
    });
  });

  it("preserves update behavior for legacy-only teams", async () => {
    const eventCode = "TEAMPUT1";
    insertEvent(eventCode);
    createTeamsEventDb(eventCode, {
      legacyTeams: [
        {
          teamNumber: 222,
          teamNameShort: "Bravo Short",
          teamNameLong: "Bravo Long",
          organizationSchool: "Legacy Org",
          city: "Hue",
          country: "Vietnam",
        },
      ],
    });

    const app = createTeamsTestApp();
    const token = await createAdminToken(eventCode);

    const unauthorizedResponse = await app.request(
      `http://localhost/${eventCode}/teams/222`,
      {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          teamName: "Bravo Updated",
        }),
      }
    );
    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({
      error: "Unauthorized",
    });

    const updateResponse = await app.request(
      `http://localhost/${eventCode}/teams/222`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          teamName: "Bravo Updated",
          organizationSchool: "Updated Org",
          city: "Can Tho",
          country: "Vietnam",
        }),
      }
    );
    expect(updateResponse.status).toBe(200);
    expect(await updateResponse.json()).toEqual({
      team: {
        teamNumber: 222,
        teamName: "Bravo Updated",
        organizationSchool: "Updated Org",
        city: "Can Tho",
        country: "Vietnam",
        advancement: 0,
        division: 1,
      },
    });

    expect(readStoredTeamSnapshot(eventCode, 222)).toEqual({
      legacyTeam: {
        team_number: 222,
        team_name_short: "Bravo Short",
        team_name_long: "Bravo Long",
        school_name: "Legacy Org",
        city: "Hue",
        country: "Vietnam",
      },
      metadataTeam: {
        team_number: 222,
        team_name: "Bravo Updated",
        organization_school: "Updated Org",
        city: "Can Tho",
        country: "Vietnam",
      },
      teamsRow: null,
    });
  });

  it("preserves delete behavior across all team storage tables", async () => {
    const eventCode = "TEAMDEL1";
    insertEvent(eventCode);
    createTeamsEventDb(eventCode, {
      teamsRows: [{ teamNumber: 777, advancement: 1, division: 3 }],
      metadataTeams: [
        {
          teamNumber: 777,
          teamName: "Delete Me",
          organizationSchool: "Delete Org",
          city: "Hanoi",
          country: "Vietnam",
        },
      ],
      legacyTeams: [
        {
          teamNumber: 777,
          teamNameShort: "Delete Legacy",
          teamNameLong: "Delete Legacy Long",
          organizationSchool: "Delete Legacy Org",
          city: "Hue",
          country: "Vietnam",
        },
      ],
    });

    const app = createTeamsTestApp();
    const token = await createAdminToken(eventCode);

    const unauthorizedResponse = await app.request(
      `http://localhost/${eventCode}/teams/777`,
      { method: "DELETE" }
    );
    expect(unauthorizedResponse.status).toBe(401);
    expect(await unauthorizedResponse.json()).toEqual({
      error: "Unauthorized",
    });

    const deleteResponse = await app.request(
      `http://localhost/${eventCode}/teams/777`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      }
    );
    expect(deleteResponse.status).toBe(200);
    expect(await deleteResponse.json()).toEqual({ deletedTeamNumber: 777 });

    const listResponse = await app.request(
      `http://localhost/${eventCode}/teams?search=777`
    );
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual({
      eventCode,
      teams: [],
    });

    expect(readStoredTeamSnapshot(eventCode, 777)).toEqual({
      legacyTeam: null,
      metadataTeam: null,
      teamsRow: null,
    });
  });
});
