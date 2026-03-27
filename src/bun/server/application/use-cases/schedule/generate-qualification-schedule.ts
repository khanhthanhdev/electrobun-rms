import { ApplicationError } from "../../common/application-error";
import type {
  GenerateQualificationScheduleInput,
  QualificationScheduleResponse,
} from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import { buildQualificationLineups } from "./qualification-generation";
import { toQualificationScheduleResponse } from "./responses";
import {
  DEFAULT_QUALS_CYCLE_TIME_SECONDS,
  DEFAULT_QUALS_FIELD_START_OFFSET_SECONDS,
  DEFAULT_QUALS_MATCHES_PER_TEAM,
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  normalizeScheduleEventCode,
  normalizeTimestamp,
} from "./shared";

export interface GenerateQualificationScheduleCommand {
  eventCode: string;
  payload: GenerateQualificationScheduleInput;
}

const resolveQualificationStartTime = async (
  eventCode: string,
  payload: GenerateQualificationScheduleInput,
  scheduleRepository: ScheduleRepository
): Promise<number> => {
  if (payload.startTime !== undefined) {
    return normalizeTimestamp(payload.startTime);
  }

  const existing =
    await scheduleRepository.loadQualificationSchedule(eventCode);
  return existing.config.startTime ?? Date.now();
};

export class GenerateQualificationScheduleUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: GenerateQualificationScheduleCommand
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
    if (context.teamNumbers.length < 2) {
      throw new ApplicationError(
        "At least two teams are required to generate a qualification schedule.",
        400
      );
    }

    const matchesPerTeam = normalizePositiveInteger(
      command.payload.matchesPerTeam,
      DEFAULT_QUALS_MATCHES_PER_TEAM,
      "matchesPerTeam"
    );
    const startTime = await resolveQualificationStartTime(
      eventCode,
      command.payload,
      this.scheduleRepository
    );

    await this.scheduleRepository.replaceQualificationSchedule(eventCode, {
      cycleTimeSeconds,
      fieldCount,
      fieldStartOffsetSeconds,
      matchesPerTeam,
      startTime,
      matches: buildQualificationLineups(
        context.teamNumbers,
        startTime,
        cycleTimeSeconds,
        fieldStartOffsetSeconds,
        fieldCount,
        matchesPerTeam
      ),
    });

    const schedule =
      await this.scheduleRepository.loadQualificationSchedule(eventCode);
    return toQualificationScheduleResponse(eventCode, schedule);
  }
}
