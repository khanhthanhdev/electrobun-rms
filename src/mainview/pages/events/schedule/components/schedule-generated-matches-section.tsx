import type { PrintDestination } from "../../../../shared/services/print-service";
import type { ScheduleMatchRow } from "./schedule-match-table";
import { ScheduleMatchTable } from "./schedule-match-table";
import { ScheduleSection } from "./schedule-section";

interface ScheduleGeneratedMatchesSectionProps {
  emptyMessage: string;
  isPrintDisabled?: boolean;
  matches: ScheduleMatchRow[];
  onPrint?: (destination: PrintDestination) => void;
  title?: string;
}

export const ScheduleGeneratedMatchesSection = ({
  emptyMessage,
  isPrintDisabled = false,
  matches,
  onPrint,
  title = "Generated Matches",
}: ScheduleGeneratedMatchesSectionProps): JSX.Element => (
  <ScheduleSection
    isPrintDisabled={isPrintDisabled}
    onPrint={onPrint}
    title={title}
  >
    <ScheduleMatchTable emptyMessage={emptyMessage} matches={matches} />
  </ScheduleSection>
);
