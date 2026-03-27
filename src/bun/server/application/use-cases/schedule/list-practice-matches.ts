import type { PracticeScheduleResponse } from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { toPracticeScheduleResponse } from "./responses";
import { normalizeScheduleEventCode } from "./shared";

export interface ListPracticeMatchesQuery {
  eventCode: string;
}

export class ListPracticeMatchesUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    query: ListPracticeMatchesQuery
  ): Promise<PracticeScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(query.eventCode);
    const schedule =
      await this.scheduleRepository.loadPracticeSchedule(eventCode);
    return toPracticeScheduleResponse(eventCode, schedule);
  }
}
