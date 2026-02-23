import type { ReactNode } from "react";

export interface ScheduleConfigCardItem {
  label: string;
  value: ReactNode;
}

interface ScheduleConfigCardsProps {
  items: ScheduleConfigCardItem[];
  labelTag?: "h3" | "h4";
}

export const ScheduleConfigCards = ({
  items,
  labelTag = "h3",
}: ScheduleConfigCardsProps): JSX.Element => (
  <div className="schedule-metrics-grid">
    {items.map((item) => {
      const LabelTag = labelTag;
      return (
        <article className="schedule-metric-card" key={item.label}>
          <LabelTag className="schedule-metric-label">{item.label}</LabelTag>
          <p className="schedule-metric-value">{item.value}</p>
        </article>
      );
    })}
  </div>
);
