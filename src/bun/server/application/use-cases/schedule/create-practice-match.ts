import type {
  PracticeScheduleResponse,
  SavePracticeScheduleInput,
} from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { toPracticeScheduleResponse } from "./responses";
import {
  buildScheduleWindowFromMatches,
  computeMatchTimes,
  DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
  normalizeLineupInput,
  normalizePositiveInteger,
  normalizeScheduleEventCode,
  normalizeTimestamp,
} from "./shared";

export interface CreatePracticeMatchCommand {
  eventCode: string;
  payload: SavePracticeScheduleInput;
}

export class CreatePracticeMatchUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: CreatePracticeMatchCommand
  ): Promise<PracticeScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(command.eventCode);
    const context = await this.scheduleRepository.loadEventContext(eventCode);
    const cycleTimeSeconds = normalizePositiveInteger(
      command.payload.cycleTimeSeconds,
      DEFAULT_PRACTICE_CYCLE_TIME_SECONDS,
      "cycleTimeSeconds"
    );
    const startTime = normalizeTimestamp(command.payload.startTime);
    const matches = normalizeLineupInput(command.payload.matches).map(
      (match, index) => {
        const matchTimes = computeMatchTimes(
          index,
          startTime,
          cycleTimeSeconds,
          {
            fieldCount: context.fieldCount,
          }
        );

        return {
          matchNumber: match.matchNumber,
          redTeam: match.redTeam,
          redSurrogate: Boolean(match.redSurrogate),
          blueTeam: match.blueTeam,
          blueSurrogate: Boolean(match.blueSurrogate),
          startTime: matchTimes.startTime,
          endTime: matchTimes.endTime,
        };
      }
    );
    const window = buildScheduleWindowFromMatches(matches, startTime);

    await this.scheduleRepository.replacePracticeSchedule(eventCode, {
      matches,
      window,
      blocks: [
        {
          startTime: window.startTime,
          endTime: window.endTime,
          cycleTimeSeconds,
        },
      ],
    });

    const schedule =
      await this.scheduleRepository.loadPracticeSchedule(eventCode);
    return toPracticeScheduleResponse(eventCode, schedule);
  }
}
