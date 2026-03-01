import type { ReactNode } from "react";
import {
  type ScheduleConfigCardItem,
  ScheduleConfigCards,
} from "./schedule-config-cards";
import type { OneVsOneScheduleMetrics } from "./schedule-metrics";
import {
  type BuildSummaryItemsInput,
  buildOneVsOneMetricItems,
  buildOneVsOneSummaryItems,
} from "./schedule-overview";
import { ScheduleSection } from "./schedule-section";

interface ScheduleOverviewSectionProps {
  controls?: ReactNode;
  metricItems: ScheduleConfigCardItem[];
  metricTitle?: string;
  summaryItems: ScheduleConfigCardItem[];
  summaryTitle?: string;
}

export const ScheduleOverviewSection = ({
  controls,
  metricItems,
  metricTitle = "Schedule Metrics",
  summaryItems,
  summaryTitle = "Schedule Summary",
}: ScheduleOverviewSectionProps): JSX.Element => (
  <div className="schedule-overview">
    <ScheduleSection title={summaryTitle}>
      {controls ? (
        <div className="schedule-overview-controls">{controls}</div>
      ) : null}
      <ScheduleConfigCards items={summaryItems} />
    </ScheduleSection>
    <ScheduleSection title={metricTitle}>
      <ScheduleConfigCards items={metricItems} labelTag="h4" />
    </ScheduleSection>
  </div>
);

interface OneVsOneScheduleOverviewProps extends BuildSummaryItemsInput {
  controls?: ReactNode;
  metrics: OneVsOneScheduleMetrics;
  metricTitle?: string;
  summaryTitle?: string;
}

export const OneVsOneScheduleOverview = ({
  controls,
  metrics,
  metricTitle,
  summaryTitle,
  ...summaryInput
}: OneVsOneScheduleOverviewProps): JSX.Element => {
  const summaryItems = buildOneVsOneSummaryItems(summaryInput);
  const metricItems = buildOneVsOneMetricItems(metrics);

  return (
    <ScheduleOverviewSection
      controls={controls}
      metricItems={metricItems}
      metricTitle={metricTitle}
      summaryItems={summaryItems}
      summaryTitle={summaryTitle}
    />
  );
};
