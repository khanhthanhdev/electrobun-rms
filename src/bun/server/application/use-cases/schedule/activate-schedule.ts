import type {
  PracticeScheduleResponse,
  QualificationScheduleResponse,
  ScheduleType,
} from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import {
  toPracticeScheduleResponse,
  toQualificationScheduleResponse,
} from "./responses";
import { normalizeScheduleEventCode } from "./shared";

export interface ActivateScheduleCommand {
  active: boolean;
  eventCode: string;
  scheduleType: ScheduleType;
}

export class ActivateScheduleUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: ActivateScheduleCommand
  ): Promise<PracticeScheduleResponse | QualificationScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(command.eventCode);
    await this.scheduleRepository.setScheduleActivation(
      eventCode,
      command.scheduleType,
      command.active
    );

    if (command.scheduleType === "practice") {
      const schedule =
        await this.scheduleRepository.loadPracticeSchedule(eventCode);
      return toPracticeScheduleResponse(eventCode, schedule);
    }

    const schedule =
      await this.scheduleRepository.loadQualificationSchedule(eventCode);
    return toQualificationScheduleResponse(eventCode, schedule);
  }
}
