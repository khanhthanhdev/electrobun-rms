import type { InspectionRepository } from "../../interfaces/inspection-repository";

export class GetChecklistUseCase {
  constructor(private readonly inspectionRepository: InspectionRepository) {}

  execute() {
    return this.inspectionRepository.getChecklist();
  }
}
