import type { TimingRules } from "../season-rule-types";

export const timingRules: TimingRules = {
  matchDurationSeconds: 480,
  defaultMatchesPerTeam: 6,
  defaultCycleTimeSecondsByType: {
    practice: 180,
    quals: 240,
  },
  defaultFieldStartOffsetSecondsByType: {
    practice: 0,
    quals: 15,
  },
};
