import type {
  ScoreBreakdown,
  ScoreMetricDefinition,
  ScoringRules,
} from "../season-rule-types";

const POINTS_A_SECOND_TIER_FLAG = 25;
const POINTS_A_FIRST_TIER_FLAG = 20;
const POINTS_A_CENTER_FLAG = 10;
const POINTS_B_CENTER_FLAG_DOWN = 30;
const POINTS_B_BASE_FLAG_DOWN = 10;
const POINTS_D_GOLD_FLAG_DEFENDED = 10;

const computeParkPoints = (parkState: number): number => {
  if (parkState === 1) {
    return 10;
  }
  if (parkState === 2) {
    return 15;
  }
  return 0;
};

const computeAllianceScore = (
  input: Record<string, number>
): ScoreBreakdown => {
  const scoreA =
    (input.aSecondTierFlags ?? 0) * POINTS_A_SECOND_TIER_FLAG +
    (input.aFirstTierFlags ?? 0) * POINTS_A_FIRST_TIER_FLAG +
    (input.aCenterFlags ?? 0) * POINTS_A_CENTER_FLAG;
  const scoreB =
    (input.bCenterFlagDown ?? 0) * POINTS_B_CENTER_FLAG_DOWN +
    (input.bBaseFlagsDown ?? 0) * POINTS_B_BASE_FLAG_DOWN;
  const scoreC = input.cOpponentBackfieldBullets ?? 0;
  const scoreD =
    computeParkPoints(input.dRobotParkState ?? 0) +
    (input.dGoldFlagsDefended ?? 0) * POINTS_D_GOLD_FLAG_DEFENDED;
  const scoreTotal = scoreA + scoreB + scoreC + scoreD;

  return { scoreA, scoreB, scoreC, scoreD, scoreTotal };
};

const metrics: ScoreMetricDefinition[] = [
  { key: "aSecondTierFlags", label: "Second Tier Flags", minValue: 0 },
  { key: "aFirstTierFlags", label: "First Tier Flags", minValue: 0 },
  { key: "aCenterFlags", label: "Center Flags", minValue: 0 },
  {
    key: "bCenterFlagDown",
    label: "Center Flag Down",
    minValue: 0,
    maxValue: 1,
  },
  { key: "bBaseFlagsDown", label: "Base Flags Down", minValue: 0 },
  {
    key: "cOpponentBackfieldBullets",
    label: "Opponent Backfield Bullets",
    minValue: 0,
  },
  {
    key: "dRobotParkState",
    label: "Robot Park State",
    minValue: 0,
    maxValue: 2,
  },
  { key: "dGoldFlagsDefended", label: "Gold Flags Defended", minValue: 0 },
];

export const scoringRules: ScoringRules = {
  computeAllianceScore,
  metrics,
};
