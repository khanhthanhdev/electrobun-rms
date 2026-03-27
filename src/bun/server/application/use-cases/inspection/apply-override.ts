import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface ApplyOverrideCommand {
  changedBy: string;
  comment: string;
  eventCode: string;
  teamNumber: number;
}

export class ApplyOverrideUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: ApplyOverrideCommand) {
    return this.inspectionRepository.overrideInspectionStatus(
      command.eventCode,
      command.teamNumber,
      command.comment,
      command.changedBy
    );
  }
}
