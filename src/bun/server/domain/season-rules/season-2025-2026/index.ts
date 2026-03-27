import type { SeasonRuleSet } from "../season-rule-types";
import { matchFormatRules } from "./match-format";
import { rankingRules } from "./ranking";
import { scoringRules } from "./scoring";
import { timingRules } from "./timing";

export const season20252026: SeasonRuleSet = {
  seasonId: "2025-2026",
  matchFormat: matchFormatRules,
  timing: timingRules,
  scoring: scoringRules,
  ranking: rankingRules,
};
