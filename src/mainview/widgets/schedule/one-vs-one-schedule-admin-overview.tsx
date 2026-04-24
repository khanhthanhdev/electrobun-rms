import type { OneVsOneScheduleMetrics } from "./schedule-metrics";
import { OneVsOneScheduleOverview } from "./schedule-overview-section";

interface OneVsOneScheduleAdminOverviewProps {
  cycleTimeSeconds: number;
  fieldCount: number;
  fieldCountMax?: number;
  fieldStartOffsetSeconds: number;
  generatedMatchCount: number;
  isActive: boolean;
  matchesPerTeam: number;
  metrics: OneVsOneScheduleMetrics;
  onCycleTimeSecondsChange: (value: number) => void;
  onFieldCountChange: (value: number) => void;
  onFieldStartOffsetSecondsChange: (value: number) => void;
  onMatchesPerTeamChange: (value: number) => void;
  teamCount: number;
  totalMatchesRequired: number;
}

export const OneVsOneScheduleAdminOverview = ({
  cycleTimeSeconds,
  fieldCount,
  fieldCountMax,
  fieldStartOffsetSeconds,
  generatedMatchCount,
  isActive,
  matchesPerTeam,
  metrics,
  onCycleTimeSecondsChange,
  onFieldCountChange,
  onFieldStartOffsetSecondsChange,
  onMatchesPerTeamChange,
  teamCount,
  totalMatchesRequired,
}: OneVsOneScheduleAdminOverviewProps): JSX.Element => (
  <OneVsOneScheduleOverview
    cycleTimeSeconds={cycleTimeSeconds}
    editable={{
      matchesPerTeam: { min: 1, onChange: onMatchesPerTeamChange },
      fieldCount: {
        min: 1,
        max: fieldCountMax,
        onChange: onFieldCountChange,
      },
      cycleTimeSeconds: { min: 1, onChange: onCycleTimeSecondsChange },
      fieldStartOffsetSeconds: {
        min: 0,
        onChange: onFieldStartOffsetSecondsChange,
      },
    }}
    fieldCount={fieldCount}
    fieldStartOffsetSeconds={fieldStartOffsetSeconds}
    generatedMatchCount={generatedMatchCount}
    isActive={isActive}
    matchesPerTeam={matchesPerTeam}
    metrics={metrics}
    teamCount={teamCount}
    totalMatchesRequired={totalMatchesRequired}
  />
);
