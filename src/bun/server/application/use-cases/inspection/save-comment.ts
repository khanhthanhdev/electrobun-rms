import type { InspectionRepository } from "../../interfaces/inspection-repository";

export interface SaveCommentCommand {
  comment: string;
  eventCode: string;
  teamNumber: number;
}

export class SaveInspectionCommentUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute(command: SaveCommentCommand) {
    this.inspectionRepository.saveInspectionComment(
      command.eventCode,
      command.teamNumber,
      command.comment
    );
  }
}
