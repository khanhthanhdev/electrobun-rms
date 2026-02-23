import type { ReactNode } from "react";
import { LoadingIndicator } from "../../../../shared/components/loading-indicator";
import "../../../../app/styles/components/schedule.css";
import { MatchBlockEditor } from "./match-block-editor";
import type { MatchBlockState } from "./schedule-utils";

interface SchedulePageLayoutProps {
  alerts?: ReactNode;
  children: ReactNode;
  configSection?: ReactNode;
  defaultCycleTimeMinutes: number;
  errorMessage: string | null;
  eventCode: string;
  isLoading: boolean;
  matchBlocks: MatchBlockState[];
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  onScheduleDateChange: (date: string) => void;
  scheduleDate: string;
  successMessage: string | null;
  teamCount: number;
  title: string;
  toolbar: ReactNode;
}

export const SchedulePageLayout = ({
  title,
  eventCode,
  isLoading,
  errorMessage,
  successMessage,
  alerts,
  configSection,
  scheduleDate,
  onScheduleDateChange,
  matchBlocks,
  onMatchBlocksChange,
  defaultCycleTimeMinutes,
  teamCount,
  toolbar,
  children,
}: SchedulePageLayoutProps): JSX.Element => {
  if (isLoading) {
    return (
      <main className="page-shell page-shell--center schedule-page">
        <LoadingIndicator />
      </main>
    );
  }

  return (
    <main className="page-shell page-shell--top schedule-page">
      <div className="card surface-card stack schedule-page-shell">
        <a
          className="back-link schedule-page-back-link"
          href={`/event/${eventCode}/dashboard`}
        >
          &lt;&lt; Back to Dashboard
        </a>

        {alerts}

        <header className="schedule-page-header">
          <h2 className="app-heading schedule-page-title">{title}</h2>
        </header>

        {errorMessage ? (
          <p className="message-block" data-variant="danger" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <output className="message-block" data-variant="success">
            {successMessage}
          </output>
        ) : null}

        {configSection}

        <div className="schedule-date-section">
          <label
            className="app-heading app-heading--small schedule-date-heading"
            htmlFor="schedule-date"
          >
            Schedule Date
          </label>
          <input
            className="schedule-date-input"
            id="schedule-date"
            onChange={(e) => onScheduleDateChange(e.target.value)}
            type="date"
            value={scheduleDate}
          />
        </div>

        <MatchBlockEditor
          defaultCycleTimeMinutes={defaultCycleTimeMinutes}
          matchBlocks={matchBlocks}
          onMatchBlocksChange={onMatchBlocksChange}
          scheduleDate={scheduleDate}
          teamCount={teamCount}
        />

        <div className="schedule-toolbar">{toolbar}</div>

        {children}
      </div>
    </main>
  );
};
