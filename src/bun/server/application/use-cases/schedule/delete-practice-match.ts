import type { PracticeScheduleResponse } from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { toPracticeScheduleResponse } from "./responses";
import { normalizeScheduleEventCode } from "./shared";

export interface DeletePracticeMatchCommand {
  eventCode: string;
}

export class DeletePracticeMatchUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: DeletePracticeMatchCommand
  ): Promise<PracticeScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(command.eventCode);
    await this.scheduleRepository.clearPracticeSchedule(eventCode);
    const schedule =
      await this.scheduleRepository.loadPracticeSchedule(eventCode);
    return toPracticeScheduleResponse(eventCode, schedule);
  }
}
