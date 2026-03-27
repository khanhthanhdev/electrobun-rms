import type {
  CreateTeamInput,
  SeedTeamInput,
  TeamItem,
  UpdateTeamInput,
} from "../../../application/dtos/teams";
import type { TeamRepository } from "../../../application/interfaces/team-repository";
import { loadTeamsFromEventDb } from "./sqlite-team-loaders";
import {
  createTeamInEventDb,
  deleteTeamInEventDb,
  seedTeamsInEventDb,
  updateTeamInEventDb,
} from "./sqlite-team-persistence";
import { assertEventExists, withEventDb } from "./sqlite-team-shared";

export class SQLiteTeamRepository implements TeamRepository {
  listTeams(eventCode: string): Promise<TeamItem[]> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      return withEventDb(eventCode, (eventDb) => loadTeamsFromEventDb(eventDb));
    });
  }

  createTeam(eventCode: string, input: CreateTeamInput): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) => createTeamInEventDb(eventDb, input));
    });
  }

  updateTeam(
    eventCode: string,
    teamNumber: number,
    input: UpdateTeamInput
  ): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) =>
        updateTeamInEventDb(eventDb, eventCode, teamNumber, input)
      );
    });
  }

  deleteTeam(eventCode: string, teamNumber: number): Promise<void> {
    return Promise.resolve().then(() => {
      assertEventExists(eventCode);
      withEventDb(eventCode, (eventDb) =>
        deleteTeamInEventDb(eventDb, eventCode, teamNumber)
      );
    });
  }

  seedTeams(eventCode: string, inputs: SeedTeamInput[]): Promise<void> {
    return Promise.resolve().then(() => {
      withEventDb(eventCode, (eventDb) => seedTeamsInEventDb(eventDb, inputs));
    });
  }
}
