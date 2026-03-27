import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface GetTeamListCommand {
  eventCode: string;
  search?: string;
}

export class GetTeamListUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: GetTeamListCommand) {
    return this.inspectionRepository.listInspectionTeams(
      command.eventCode,
      command.search
    );
  }
}
