import type { InspectionStatus } from "../../dtos/inspection";
import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface UpdateStatusCommand {
  changedBy: string;
  eventCode: string;
  status: InspectionStatus;
  teamNumber: number;
}

export class UpdateInspectionStatusUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: UpdateStatusCommand) {
    return this.inspectionRepository.updateInspectionStatus(
      command.eventCode,
      command.teamNumber,
      command.status,
      command.changedBy
    );
  }
}
