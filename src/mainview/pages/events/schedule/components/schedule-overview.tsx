import type { ReactNode } from "react";
import type { ScheduleConfigCardItem } from "./schedule-config-cards";
import type { OneVsOneScheduleMetrics } from "./schedule-metrics";

interface EditableFieldConfig {
  max?: number;
  min?: number;
  onChange: (value: number) => void;
}

export interface BuildSummaryItemsInput {
  cycleTimeSeconds: number;
  editable?: {
    cycleTimeSeconds?: EditableFieldConfig;
    fieldCount?: EditableFieldConfig;
    fieldStartOffsetSeconds?: EditableFieldConfig;
    matchesPerTeam?: EditableFieldConfig;
  };
  fieldCount: number;
  fieldStartOffsetSeconds: number;
  generatedMatchCount: number;
  isActive: boolean;
  matchesPerTeam: number;
  teamCount: number;
  totalMatchesRequired: number;
}

const renderValue = (
  value: number,
  config?: EditableFieldConfig
): ReactNode => {
  if (!config) {
    return value;
  }
  return (
    <input
      className="schedule-metric-input"
      max={config.max}
      min={config.min ?? 0}
      onChange={(e) =>
        config.onChange(
          Math.min(
            config.max ?? Number.POSITIVE_INFINITY,
            Math.max(config.min ?? 0, Number.parseInt(e.target.value, 10) || 0)
          )
        )
      }
      type="number"
      value={value}
    />
  );
};

export const buildOneVsOneSummaryItems = ({
  cycleTimeSeconds,
  editable,
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
    value: renderValue(matchesPerTeam, editable?.matchesPerTeam),
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
    value: renderValue(fieldCount, editable?.fieldCount),
  },
  {
    label: "Cycle Time (sec)",
    value: renderValue(cycleTimeSeconds, editable?.cycleTimeSeconds),
  },
  {
    label: "Field Offset (sec)",
    value: renderValue(
      fieldStartOffsetSeconds,
      editable?.fieldStartOffsetSeconds
    ),
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
