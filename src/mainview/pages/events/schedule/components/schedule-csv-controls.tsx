import type { RefObject } from "react";
import { ScheduleActionButton } from "./schedule-action-button";

interface ScheduleCsvControlsProps {
  description: string;
  exportDisabled?: boolean;
  fileInputRef: RefObject<HTMLInputElement>;
  generatedMessage?: string;
  importDisabled?: boolean;
  onExport: () => void;
  onImport: () => void;
}

export const ScheduleCsvControls = ({
  description,
  exportDisabled = false,
  fileInputRef,
  generatedMessage,
  importDisabled = false,
  onExport,
  onImport,
}: ScheduleCsvControlsProps): JSX.Element => (
  <div className="schedule-csv-controls">
    <p className="schedule-csv-controls__title">Custom Scheduling</p>
    <div className="schedule-csv-controls__notice">{description}</div>

    <div className="schedule-csv-controls__actions">
      <ScheduleActionButton
        disabled={exportDisabled}
        onClick={onExport}
        variant="neutral"
      >
        Export Schedule
      </ScheduleActionButton>
      <input
        accept=".csv"
        aria-label="Import CSV schedule"
        onChange={onImport}
        ref={fileInputRef}
        style={{ display: "none" }}
        type="file"
      />
      <ScheduleActionButton
        disabled={importDisabled}
        onClick={() => fileInputRef.current?.click()}
        variant="muted"
      >
        Import Schedule
      </ScheduleActionButton>
    </div>

    {generatedMessage ? (
      <p className="schedule-csv-controls__message">{generatedMessage}</p>
    ) : null}
  </div>
);
