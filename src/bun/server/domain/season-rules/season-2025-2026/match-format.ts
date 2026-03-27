import type { MatchFormatRules } from "../season-rule-types";

export const matchFormatRules: MatchFormatRules = {
  allianceColors: ["red", "blue"] as const,
  teamsPerAlliance: 1,
  supportedMatchTypes: ["practice", "quals", "elims"] as const,
  allowSurrogates: true,
};
