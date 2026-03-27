import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface GetTeamDetailCommand {
  eventCode: string;
  teamNumber: number;
}

export class GetTeamDetailUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: GetTeamDetailCommand) {
    return this.inspectionRepository.getInspectionDetail(
      command.eventCode,
      command.teamNumber
    );
  }
}
