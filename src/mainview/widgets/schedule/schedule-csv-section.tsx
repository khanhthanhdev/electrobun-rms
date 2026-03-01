import type { RefObject } from "react";
import { ScheduleCsvControls } from "./schedule-csv-controls";
import { ScheduleSection } from "./schedule-section";

interface ScheduleCsvSectionProps {
  description: string;
  fileInputRef: RefObject<HTMLInputElement>;
  hasMatches: boolean;
  importDisabled?: boolean;
  onExport: () => void;
  onImport: () => void;
  title?: string;
}

export const ScheduleCsvSection = ({
  description,
  fileInputRef,
  hasMatches,
  importDisabled = false,
  onExport,
  onImport,
  title = "CSV Import / Export",
}: ScheduleCsvSectionProps): JSX.Element => (
  <ScheduleSection title={title}>
    <ScheduleCsvControls
      description={description}
      exportDisabled={!hasMatches}
      fileInputRef={fileInputRef}
      generatedMessage={
        hasMatches ? "Schedule has been generated, see below." : undefined
      }
      importDisabled={importDisabled}
      onExport={onExport}
      onImport={onImport}
    />
  </ScheduleSection>
);
