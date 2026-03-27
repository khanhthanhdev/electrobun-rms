import { ApplicationError } from "../../common/application-error";
import type {
  GeneratePracticeScheduleInput,
  MatchBlockInput,
  PracticeScheduleResponse,
} from "../../dtos/schedule";
import type { ScheduleRepository } from "../../interfaces/schedule-repository";
import {
  buildPracticeScheduleMatches,
  computeBlockCapacity,
} from "./practice-generation";
import { toPracticeScheduleResponse } from "./responses";
import {
  normalizeNonNegativeInteger,
  normalizePositiveInteger,
  normalizeScheduleEventCode,
} from "./shared";

export interface GeneratePracticeScheduleCommand {
  eventCode: string;
  payload: GeneratePracticeScheduleInput;
}

const normalizePracticeBlocks = (
  blocks: MatchBlockInput[],
  fieldStartOffsetSeconds: number
): MatchBlockInput[] => {
  if (blocks.length === 0) {
    throw new ApplicationError(
      "At least one match block is required to generate a practice schedule.",
      400
    );
  }

  return blocks
    .map((block, index) => {
      if (!Number.isFinite(block.startTime) || block.startTime <= 0) {
        throw new ApplicationError(
          `Match block ${index + 1}: startTime must be a valid timestamp.`,
          400
        );
      }
      if (!Number.isFinite(block.endTime) || block.endTime <= block.startTime) {
        throw new ApplicationError(
          `Match block ${index + 1}: endTime must be after startTime.`,
          400
        );
      }

      const cycleTimeSeconds = normalizePositiveInteger(
        block.cycleTimeSeconds,
        block.cycleTimeSeconds,
        `Match block ${index + 1} cycleTimeSeconds`
      );
      if (fieldStartOffsetSeconds >= cycleTimeSeconds) {
        throw new ApplicationError(
          `Match block ${index + 1}: fieldStartOffsetSeconds must be smaller than cycleTimeSeconds.`,
          400
        );
      }

      return {
        startTime: Math.trunc(block.startTime),
        endTime: Math.trunc(block.endTime),
        cycleTimeSeconds,
      };
    })
    .sort((left, right) => left.startTime - right.startTime);
};

export class GeneratePracticeScheduleUseCase {
  constructor(private readonly scheduleRepository: ScheduleRepository) {}

  async execute(
    command: GeneratePracticeScheduleCommand
  ): Promise<PracticeScheduleResponse> {
    const eventCode = normalizeScheduleEventCode(command.eventCode);
    const context = await this.scheduleRepository.loadEventContext(eventCode);
    const fieldStartOffsetSeconds = normalizeNonNegativeInteger(
      command.payload.fieldStartOffsetSeconds,
      0,
      "fieldStartOffsetSeconds"
    );
    const matchesPerTeam = normalizePositiveInteger(
      command.payload.matchesPerTeam,
      1,
      "matchesPerTeam"
    );
    const blocks = normalizePracticeBlocks(
      command.payload.matchBlocks,
      fieldStartOffsetSeconds
    );

    if (context.teamNumbers.length < 2) {
      throw new ApplicationError(
        "At least two teams are required to generate a practice schedule.",
        400
      );
    }

    const totalCapacity = blocks.reduce(
      (sum, block) =>
        sum +
        computeBlockCapacity(block, {
          fieldCount: context.fieldCount,
          fieldStartOffsetSeconds,
        }),
      0
    );
    const totalMatchesNeeded = Math.ceil(
      (context.teamNumbers.length * matchesPerTeam) / 2
    );

    if (totalCapacity < totalMatchesNeeded) {
      throw new ApplicationError(
        `Not enough time in match blocks. Need ${totalMatchesNeeded} matches but blocks can only fit ${totalCapacity}. Add more match blocks or increase the time window.`,
        400
      );
    }

    await this.scheduleRepository.replacePracticeSchedule(eventCode, {
      matches: buildPracticeScheduleMatches({
        blocks,
        fieldCount: context.fieldCount,
        fieldStartOffsetSeconds,
        matchesPerTeam,
        teamNumbers: context.teamNumbers,
      }),
      blocks,
      window: {
        startTime: blocks[0].startTime,
        endTime: blocks.at(-1)?.endTime ?? blocks[0].endTime,
      },
    });

    const schedule =
      await this.scheduleRepository.loadPracticeSchedule(eventCode);
    return toPracticeScheduleResponse(eventCode, schedule);
  }
}
