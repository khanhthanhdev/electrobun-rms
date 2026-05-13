import type { ReactNode } from "react";
import { LoadingIndicator } from "@/shared/components/loading-indicator";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import { MatchBlockEditor } from "./match-block-editor";

interface SchedulePageLayoutProps {
  alerts?: ReactNode;
  children: ReactNode;
  configSection?: ReactNode;
  defaultCycleTimeMinutes: number;
  errorMessage: string | null;
  isLoading: boolean;
  matchBlocks: MatchBlockState[];
  matchEditorMode?: "practice" | "qualification";
  onCycleTimeSecondsChange?: (seconds: number) => void;
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  onScheduleDateChange: (date: string) => void;
  scheduleDate: string;
  successMessage: string | null;
  title: string;
  toolbar: ReactNode;
}

export const SchedulePageLayout = ({
  title,
  isLoading,
  errorMessage,
  successMessage,
  alerts,
  configSection,
  scheduleDate,
  onScheduleDateChange,
  matchBlocks,
  matchEditorMode,
  onCycleTimeSecondsChange,
  onMatchBlocksChange,
  defaultCycleTimeMinutes,
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
    <main className="schedule-page-shell">
      <div className="schedule-page-card">
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

        <section className="schedule-setup-panel">
          <div className="schedule-date-section">
            <div className="schedule-date-content">
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
          </div>

          <MatchBlockEditor
            defaultCycleTimeMinutes={defaultCycleTimeMinutes}
            matchBlocks={matchBlocks}
            mode={matchEditorMode}
            onCycleTimeSecondsChange={onCycleTimeSecondsChange}
            onMatchBlocksChange={onMatchBlocksChange}
          />
        </section>

        <div className="schedule-toolbar">{toolbar}</div>

        {children}
      </div>
    </main>
  );
};
