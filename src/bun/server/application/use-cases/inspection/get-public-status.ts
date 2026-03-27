import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface GetPublicStatusCommand {
  eventCode: string;
}

export class GetPublicStatusUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: GetPublicStatusCommand) {
    return this.inspectionRepository.getPublicInspectionStatus(
      command.eventCode
    );
  }
}
