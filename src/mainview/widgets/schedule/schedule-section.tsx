import type { ReactNode } from "react";
import type { PrintDestination } from "@/shared/services/print-service";
import { ScheduleActionButton } from "./schedule-action-button";

interface ScheduleSectionProps {
  children: ReactNode;
  isPrintDisabled?: boolean;
  onPrint?: (destination: PrintDestination) => void;
  title?: string;
}

export const ScheduleSection = ({
  children,
  isPrintDisabled = false,
  onPrint,
  title,
}: ScheduleSectionProps): JSX.Element => (
  <section className="schedule-preview">
    {title || onPrint ? (
      <header className="schedule-preview__header">
        {title ? (
          <h3 className="app-heading app-heading--small">{title}</h3>
        ) : null}
        {onPrint ? (
          <div className="schedule-preview__actions">
            <ScheduleActionButton
              disabled={isPrintDisabled}
              onClick={() => {
                onPrint("paper");
              }}
            >
              Print
            </ScheduleActionButton>
            <ScheduleActionButton
              disabled={isPrintDisabled}
              onClick={() => {
                onPrint("pdf");
              }}
              variant="primary"
            >
              Save PDF
            </ScheduleActionButton>
          </div>
        ) : null}
      </header>
    ) : null}
    {children}
  </section>
);
