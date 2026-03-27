import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface GetHistoryCommand {
  eventCode: string;
  teamNumber: number;
}

export class GetInspectionHistoryUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: GetHistoryCommand) {
    return this.inspectionRepository.getInspectionHistory(
      command.eventCode,
      command.teamNumber
    );
  }
}
