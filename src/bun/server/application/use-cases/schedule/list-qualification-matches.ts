import type { QualificationScheduleResponse } from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { toQualificationScheduleResponse } from "./responses";
import { normalizeScheduleEventCode } from "./shared";

export interface ListQualificationMatchesQuery {
  eventCode: string;
}

export class ListQualificationMatchesUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    query: ListQualificationMatchesQuery
  ): Promise<QualificationScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(query.eventCode);
    const schedule =
      await this.scheduleRepository.loadQualificationSchedule(eventCode);
    return toQualificationScheduleResponse(eventCode, schedule);
  }
}
