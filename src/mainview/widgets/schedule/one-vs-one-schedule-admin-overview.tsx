import type { OneVsOneScheduleMetrics } from "./schedule-metrics";
import { OneVsOneScheduleOverview } from "./schedule-overview-section";

interface OneVsOneScheduleAdminOverviewProps {
  fieldCount: number;
  fieldCountMax?: number;
  fieldStartOffsetSeconds: number;
  fieldStartOffsetSecondsMax?: number;
  generatedMatchCount: number;
  isActive: boolean;
  matchesPerTeam: number;
  metrics: OneVsOneScheduleMetrics;
  onFieldCountChange: (value: number) => void;
  onFieldStartOffsetSecondsChange: (value: number) => void;
  onMatchesPerTeamChange: (value: number) => void;
  teamCount: number;
  totalMatchesRequired: number;
}

export const OneVsOneScheduleAdminOverview = ({
  fieldCount,
  fieldCountMax,
  fieldStartOffsetSeconds,
  fieldStartOffsetSecondsMax,
  generatedMatchCount,
  isActive,
  matchesPerTeam,
  metrics,
  onFieldCountChange,
  onFieldStartOffsetSecondsChange,
  onMatchesPerTeamChange,
  teamCount,
  totalMatchesRequired,
}: OneVsOneScheduleAdminOverviewProps): JSX.Element => (
  <OneVsOneScheduleOverview
    editable={{
      matchesPerTeam: { min: 1, onChange: onMatchesPerTeamChange },
      fieldCount: {
        min: 1,
        max: fieldCountMax,
        onChange: onFieldCountChange,
      },
      fieldStartOffsetSeconds: {
        min: 0,
        max: fieldStartOffsetSecondsMax,
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
