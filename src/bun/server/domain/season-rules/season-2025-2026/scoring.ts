import type {
  ScoreBreakdown,
  ScoreMetricDefinition,
  ScoringRules,
} from "../season-rule-types";

const POINTS_A_SECOND_TIER_FLAG = 2;
const POINTS_A_FIRST_TIER_FLAG = 1;
const POINTS_A_CENTER_FLAG = 2;
const POINTS_B_FERTILIZER = 1;
const MAX_B_FERTILIZER = 10;
const POINTS_C_GOLD_FLAG_DEFENDED = 5;
const POINTS_PENALTY_DROPPED_FLAG = 1;

const computeParkPoints = (parkState: number): number => {
  if (parkState === 1) {
    return 2;
  }
  if (parkState === 2) {
    return 3;
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
  const fertilizerCount = Math.min(
    MAX_B_FERTILIZER,
    (input.bCenterFlagDown ?? 0) + (input.bBaseFlagsDown ?? 0)
  );
  const scoreB = fertilizerCount * POINTS_B_FERTILIZER;
  const scoreC = (input.dGoldFlagsDefended ?? 0) * POINTS_C_GOLD_FLAG_DEFENDED;
  const scoreD = computeParkPoints(input.dRobotParkState ?? 0);
  const penalty =
    (input.cOpponentBackfieldBullets ?? 0) * POINTS_PENALTY_DROPPED_FLAG;
  const scoreTotal = Math.max(0, scoreA + scoreB + scoreC + scoreD - penalty);

  return { scoreA, scoreB, scoreC, scoreD, scoreTotal };
};

const metrics: ScoreMetricDefinition[] = [
  { key: "aSecondTierFlags", label: "Second Tier Flags", minValue: 0 },
  { key: "aFirstTierFlags", label: "First Tier Flags", minValue: 0 },
  { key: "aCenterFlags", label: "Center Flags", minValue: 0 },
  {
    key: "bCenterFlagDown",
    label: "Fertilizer In Target",
    minValue: 0,
    maxValue: 10,
  },
  { key: "bBaseFlagsDown", label: "Additional Fertilizer In Target", minValue: 0 },
  {
    key: "cOpponentBackfieldBullets",
    label: "Dropped Planted Rice Penalties",
    minValue: 0,
  },
  {
    key: "dRobotParkState",
    label: "Robot Park State",
    minValue: 0,
    maxValue: 2,
  },
  { key: "dGoldFlagsDefended", label: "Gold Rice Defended", minValue: 0 },
];

export const scoringRules: ScoringRules = {
  computeAllianceScore,
  metrics,
};
