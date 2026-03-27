import { ApplicationError } from "../../common/application-error";
import type {
  QualificationScheduleResponse,
  SaveQualificationScheduleInput,
} from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { toQualificationScheduleResponse } from "./responses";
import {
  computeMatchTimes,
  countQualificationMatchesPerTeam,
  DEFAULT_QUALS_CYCLE_TIME_SECONDS,
  DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS,
  normalizeLineupInput,
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  normalizeScheduleEventCode,
  normalizeTimestamp,
} from "./shared";

export interface SaveQualificationScheduleCommand {
  eventCode: string;
  payload: SaveQualificationScheduleInput;
}

export class SaveQualificationScheduleUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: SaveQualificationScheduleCommand
  ): Promise<QualificationScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(command.eventCode);
    const context = await this.scheduleRepository.loadEventContext(eventCode);
    const cycleTimeSeconds = normalizePositiveInteger(
      command.payload.cycleTimeSeconds,
      DEFAULT_QUALS_CYCLE_TIME_SECONDS,
      "cycleTimeSeconds"
    );
    const fieldStartOffsetSeconds = normalizeNonNegativeInteger(
      command.payload.fieldStartOffsetSeconds,
      DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS,
      "fieldStartOffsetSeconds"
    );
    if (fieldStartOffsetSeconds >= cycleTimeSeconds) {
      throw new ApplicationError(
        "fieldStartOffsetSeconds must be smaller than cycleTimeSeconds.",
        400
      );
    }

    const fieldCount = normalizePositiveInteger(
      command.payload.fieldCount,
      context.fieldCount,
      "fieldCount"
    );
    if (fieldCount > context.fieldCount) {
      throw new ApplicationError(
        `fieldCount cannot exceed configured event fields (${context.fieldCount}).`,
        400
      );
    }

    const startTime = normalizeTimestamp(command.payload.startTime);
    const normalizedMatches = normalizeLineupInput(command.payload.matches);

    await this.scheduleRepository.replaceQualificationSchedule(eventCode, {
      cycleTimeSeconds,
      fieldCount,
      fieldStartOffsetSeconds,
      matchesPerTeam: countQualificationMatchesPerTeam(normalizedMatches),
      startTime,
      matches: normalizedMatches.map((match, index) => {
        const matchTimes = computeMatchTimes(
          index,
          startTime,
          cycleTimeSeconds,
          {
            fieldCount,
            fieldStartOffsetSeconds,
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
      }),
    });

    const schedule =
      await this.scheduleRepository.loadQualificationSchedule(eventCode);
    return toQualificationScheduleResponse(eventCode, schedule);
  }
}
