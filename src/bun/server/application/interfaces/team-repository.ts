import type {
  CreateTeamInput,
  SeedTeamInput,
  TeamItem,
  UpdateTeamInput,
} from "../dtos/teams";

export interface TeamRepository {
  createTeam(eventCode: string, input: CreateTeamInput): Promise<void>;

  deleteTeam(eventCode: string, teamNumber: number): Promise<void>;

  listTeams(eventCode: string): Promise<TeamItem[]>;

  seedTeams(eventCode: string, inputs: SeedTeamInput[]): Promise<void>;

  updateTeam(
    eventCode: string,
    teamNumber: number,
    input: UpdateTeamInput
  ): Promise<void>;
}
