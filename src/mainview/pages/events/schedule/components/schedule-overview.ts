import type { ScheduleConfigCardItem } from "./schedule-config-cards";
import type { OneVsOneScheduleMetrics } from "./schedule-metrics";

interface BuildSummaryItemsInput {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  generatedMatchCount: number;
  isActive: boolean;
  matchesPerTeam: number;
  teamCount: number;
  totalMatchesRequired: number;
}

export const buildOneVsOneSummaryItems = ({
  cycleTimeSeconds,
  fieldCount,
  fieldStartOffsetSeconds,
  generatedMatchCount,
  isActive,
  matchesPerTeam,
  teamCount,
  totalMatchesRequired,
}: BuildSummaryItemsInput): ScheduleConfigCardItem[] => [
  {
    label: "Team Count",
    value: teamCount,
  },
  {
    label: "Matches Per Team",
    value: matchesPerTeam,
  },
  {
    label: "Generated Matches",
    value: generatedMatchCount,
  },
  {
    label: "Total Matches Required",
    value: totalMatchesRequired,
  },
  {
    label: "Field Count",
    value: fieldCount,
  },
  {
    label: "Cycle Time (sec)",
    value: cycleTimeSeconds,
  },
  {
    label: "Field Offset (sec)",
    value: fieldStartOffsetSeconds,
  },
  {
    label: "Schedule Active",
    value: isActive ? "Active" : "Inactive",
  },
];

export const buildOneVsOneMetricItems = (
  metrics: OneVsOneScheduleMetrics
): ScheduleConfigCardItem[] => [
  {
    label: "Repeat Opponent Pairs",
    value: metrics.repeatOpponentPairs.toString(),
  },
  {
    label: "Max Opponent Repeat",
    value: metrics.maxOpponentRepeat.toString(),
  },
  {
    label: "Max Side Imbalance",
    value: metrics.maxSideImbalance.toString(),
  },
  {
    label: "Avg Side Imbalance",
    value: metrics.averageSideImbalance.toFixed(2),
  },
  {
    label: "Back-to-Back Count",
    value: metrics.backToBackCount.toString(),
  },
  {
    label: "Surrogate Slots",
    value: metrics.surrogateSlots.toString(),
  },
];
