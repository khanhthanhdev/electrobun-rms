import {
  type InferOutput,
  maxValue,
  minValue,
  number,
  object,
  picklist,
  pipe,
} from "valibot";

export const saveMatchAllianceScoreBodySchema = object({
  matchType: picklist(["quals", "elims"]),
  matchNumber: pipe(number(), minValue(1), maxValue(Number.MAX_SAFE_INTEGER)),
  alliance: picklist(["red", "blue"]),
  aSecondTierFlags: pipe(
    number(),
    minValue(0),
    maxValue(Number.MAX_SAFE_INTEGER)
  ),
  aFirstTierFlags: pipe(
    number(),
    minValue(0),
    maxValue(Number.MAX_SAFE_INTEGER)
  ),
  aCenterFlags: pipe(number(), minValue(0), maxValue(Number.MAX_SAFE_INTEGER)),
  bCenterFlagDown: pipe(number(), minValue(0), maxValue(1)),
  bBaseFlagsDown: pipe(
    number(),
    minValue(0),
    maxValue(Number.MAX_SAFE_INTEGER)
  ),
  cOpponentBackfieldBullets: pipe(
    number(),
    minValue(0),
    maxValue(Number.MAX_SAFE_INTEGER)
  ),
  dRobotParkState: pipe(number(), minValue(0), maxValue(2)),
  dGoldFlagsDefended: pipe(
    number(),
    minValue(0),
    maxValue(Number.MAX_SAFE_INTEGER)
  ),
});

export type SaveMatchAllianceScoreBody = InferOutput<
  typeof saveMatchAllianceScoreBodySchema
>;
