import { ApplicationError } from "../../common/application-error";
import type { CreateTeamInput, TeamItem } from "../../dtos/teams";
import type { TeamRepository } from "../../interfaces/team-repository";
import { normalizeTeamsEventCode } from "./shared";

export interface CreateTeamCommand {
  eventCode: string;
  payload: CreateTeamInput;
}

export class CreateTeamUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(command: CreateTeamCommand): Promise<TeamItem> {
    const eventCode = normalizeTeamsEventCode(command.eventCode);

    await this.teamRepository.createTeam(eventCode, command.payload);

    const teams = await this.teamRepository.listTeams(eventCode);
    const team = teams.find(
      (item) => item.teamNumber === command.payload.teamNumber
    );
    if (!team) {
      throw new ApplicationError("Failed to load saved team.", 500);
    }

    return team;
  }
}
