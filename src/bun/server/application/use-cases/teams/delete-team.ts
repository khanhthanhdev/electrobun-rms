import { ApplicationError } from "../../common/application-error";
import type { DeleteTeamResponse } from "../../dtos/teams";
import type { TeamRepository } from "../../interfaces/team-repository";
import { normalizeTeamsEventCode } from "./shared";

export interface DeleteTeamCommand {
  eventCode: string;
  teamNumber: number;
}

export class DeleteTeamUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(command: DeleteTeamCommand): Promise<DeleteTeamResponse> {
    const eventCode = normalizeTeamsEventCode(command.eventCode);

    await this.teamRepository.deleteTeam(eventCode, command.teamNumber);

    const teams = await this.teamRepository.listTeams(eventCode);
    const stillExists = teams.some(
      (team) => team.teamNumber === command.teamNumber
    );
    if (stillExists) {
      throw new ApplicationError("Failed to delete team.", 500);
    }

    return {
      deletedTeamNumber: command.teamNumber,
    };
  }
}
