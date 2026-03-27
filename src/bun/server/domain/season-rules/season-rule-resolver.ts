import { season20252026 } from "./season-2025-2026";
import type { SeasonRuleSet } from "./season-rule-types";

const ACTIVE_SEASON = season20252026;

export const getActiveSeasonRules = (): SeasonRuleSet => ACTIVE_SEASON;
