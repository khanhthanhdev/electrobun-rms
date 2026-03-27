import type { InspectionItemUpdate } from "../../dtos/inspection";
import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface UpdateItemsCommand {
  eventCode: string;
  items: InspectionItemUpdate[];
  teamNumber: number;
}

export class UpdateInspectionItemsUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: UpdateItemsCommand) {
    return this.inspectionRepository.updateInspectionItems(
      command.eventCode,
      command.teamNumber,
      command.items
    );
  }
}
