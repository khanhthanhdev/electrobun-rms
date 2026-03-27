import { ApplicationError } from "../../common/application-error";
import type { TeamItem, UpdateTeamInput } from "../../dtos/teams";
import type { TeamRepository } from "../../interfaces/team-repository";
import { normalizeTeamsEventCode } from "./shared";

export interface UpdateTeamCommand {
  eventCode: string;
  payload: UpdateTeamInput;
  teamNumber: number;
}

export class UpdateTeamUseCase {
  constructor(private readonly teamRepository: TeamRepository) {}

  async execute(command: UpdateTeamCommand): Promise<TeamItem> {
    const eventCode = normalizeTeamsEventCode(command.eventCode);

    await this.teamRepository.updateTeam(
      eventCode,
      command.teamNumber,
      command.payload
    );

    const teams = await this.teamRepository.listTeams(eventCode);
    const updatedTeam = teams.find(
      (item) => item.teamNumber === command.teamNumber
    );
    if (!updatedTeam) {
      throw new ApplicationError("Failed to load updated team.", 500);
    }

    return updatedTeam;
  }
}
