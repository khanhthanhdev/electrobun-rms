import { beforeEach, describe, expect, it } from "bun:test";
import {
  createTeamsEventDb,
  readStoredTeamSnapshot,
  resetTeamsTestDatabase,
} from "../../../api/teams/teams.test-support";
import { SQLiteTeamRepository } from "./sqlite-team-repository";

describe("SQLiteTeamRepository", () => {
  beforeEach(async () => {
    await resetTeamsTestDatabase();
  });

  it("preserves seedTeams for bootstrap callers before the server event exists", async () => {
    const eventCode = "TEAMSEED1";
    createTeamsEventDb(eventCode);

    const repository = new SQLiteTeamRepository();

    await repository.seedTeams(eventCode, [
      {
        teamNumber: 901,
        teamName: "Bootstrap Team",
        organizationSchool: "Bootstrap Org",
        city: "Da Nang",
        country: "Vietnam",
      },
    ]);

    expect(readStoredTeamSnapshot(eventCode, 901)).toEqual({
      legacyTeam: null,
      metadataTeam: {
        team_number: 901,
        team_name: "Bootstrap Team",
        organization_school: "Bootstrap Org",
        city: "Da Nang",
        country: "Vietnam",
      },
      teamsRow: {
        number: 901,
        advancement: 0,
        division: 1,
      },
    });
  });
});
