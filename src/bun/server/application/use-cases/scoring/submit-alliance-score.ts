import {
  getActiveSeasonRules,
  type ScoreBreakdown,
} from "../../../domain/season-rules";
import type {
  SaveMatchAllianceScoreInput,
  SaveMatchAllianceScoreResponse,
} from "../../dtos/scoring";
import type { ScoringRepository } from "../../interfaces/scoring-repository";
import { normalizeScoringEventCode } from "./shared";

export interface SubmitAllianceScoreCommand {
  eventCode: string;
  payload: SaveMatchAllianceScoreInput;
}

const computeAllianceScoreBreakdown = (
  input: SaveMatchAllianceScoreInput
): ScoreBreakdown => {
  const seasonRules = getActiveSeasonRules();
  return seasonRules.scoring.computeAllianceScore({
    aSecondTierFlags: input.aSecondTierFlags,
    aFirstTierFlags: input.aFirstTierFlags,
    aCenterFlags: input.aCenterFlags,
    bCenterFlagDown: input.bCenterFlagDown,
    bBaseFlagsDown: input.bBaseFlagsDown,
    cOpponentBackfieldBullets: input.cOpponentBackfieldBullets,
    dRobotParkState: input.dRobotParkState,
    dGoldFlagsDefended: input.dGoldFlagsDefended,
  });
};

export class SubmitAllianceScoreUseCase {
  constructor(private readonly scoringRepository: ScoringRepository) {}

  async execute(
    command: SubmitAllianceScoreCommand
  ): Promise<SaveMatchAllianceScoreResponse> {
    const normalizedEventCode = normalizeScoringEventCode(command.eventCode);
    const scoreBreakdown = computeAllianceScoreBreakdown(command.payload);
    const result = await this.scoringRepository.saveAllianceScore(
      normalizedEventCode,
      command.payload,
      scoreBreakdown
    );

    return {
      eventCode: normalizedEventCode,
      matchType: command.payload.matchType,
      matchNumber: command.payload.matchNumber,
      alliance: command.payload.alliance,
      gameSpecific: {
        aSecondTierFlags: command.payload.aSecondTierFlags,
        aFirstTierFlags: command.payload.aFirstTierFlags,
        aCenterFlags: command.payload.aCenterFlags,
        bCenterFlagDown: command.payload.bCenterFlagDown,
        bBaseFlagsDown: command.payload.bBaseFlagsDown,
        cOpponentBackfieldBullets: command.payload.cOpponentBackfieldBullets,
        dRobotParkState: command.payload.dRobotParkState,
        dGoldFlagsDefended: command.payload.dGoldFlagsDefended,
        scoreA: scoreBreakdown.scoreA,
        scoreB: scoreBreakdown.scoreB,
        scoreC: scoreBreakdown.scoreC,
        scoreD: scoreBreakdown.scoreD,
        scoreTotal: scoreBreakdown.scoreTotal,
      },
      result,
    };
  }
}
