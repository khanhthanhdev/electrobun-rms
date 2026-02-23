import type { ReactNode } from "react";
import {
  type ScheduleConfigCardItem,
  ScheduleConfigCards,
} from "./schedule-config-cards";
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
