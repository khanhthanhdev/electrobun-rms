import type { QualificationScheduleResponse } from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { toQualificationScheduleResponse } from "./responses";
import { normalizeScheduleEventCode } from "./shared";

export interface ClearQualificationScheduleCommand {
  eventCode: string;
}

export class ClearQualificationScheduleUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: ClearQualificationScheduleCommand
  ): Promise<QualificationScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(command.eventCode);
    await this.scheduleRepository.clearQualificationSchedule(eventCode);
    const schedule =
      await this.scheduleRepository.loadQualificationSchedule(eventCode);
    return toQualificationScheduleResponse(eventCode, schedule);
  }
}
