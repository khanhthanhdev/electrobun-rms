import type { ReactNode } from "react";
import type { PrintDestination } from "../../../../shared/services/print-service";
import { OneVsOneSchedulePage } from "./one-vs-one-schedule-page";
import { ScheduleGeneratedMatchesSection } from "./schedule-generated-matches-section";
import type { ScheduleMatchRow } from "./schedule-match-table";
import type { MatchBlockState } from "./schedule-utils";

interface OneVsOneScheduleViewProps {
  alerts?: ReactNode;
  beforeGeneratedSection?: ReactNode;
  configSection?: ReactNode;
  defaultCycleTimeMinutes: number;
  errorMessage: string | null;
  eventCode: string;
  generatedEmptyMessage: string;
  generatedMatches: ScheduleMatchRow[];
  generatedTitle?: string;
  hasMatches: boolean;
  isGeneratedPrintDisabled?: boolean;
  isLoading: boolean;
  matchBlocks: MatchBlockState[];
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  onPrintGeneratedMatches?: (destination: PrintDestination) => void;
  onScheduleDateChange: (date: string) => void;
  scheduleDate: string;
  successMessage: string | null;
  teamCount: number;
  title: string;
  toolbar: (args: { hasMatches: boolean }) => ReactNode;
}

export const OneVsOneScheduleView = ({
  alerts,
  beforeGeneratedSection,
  configSection,
  defaultCycleTimeMinutes,
  errorMessage,
  eventCode,
  generatedEmptyMessage,
  generatedMatches,
  generatedTitle,
  hasMatches,
  isGeneratedPrintDisabled = false,
  isLoading,
  matchBlocks,
  onMatchBlocksChange,
  onPrintGeneratedMatches,
  onScheduleDateChange,
  scheduleDate,
  successMessage,
  teamCount,
  title,
  toolbar,
}: OneVsOneScheduleViewProps): JSX.Element => (
  <OneVsOneSchedulePage
    alerts={alerts}
    configSection={configSection}
    defaultCycleTimeMinutes={defaultCycleTimeMinutes}
    errorMessage={errorMessage}
    eventCode={eventCode}
    hasMatches={hasMatches}
    isLoading={isLoading}
    matchBlocks={matchBlocks}
    onMatchBlocksChange={onMatchBlocksChange}
    onScheduleDateChange={onScheduleDateChange}
    scheduleDate={scheduleDate}
    successMessage={successMessage}
    teamCount={teamCount}
    title={title}
    toolbar={toolbar}
  >
    {beforeGeneratedSection}
    <ScheduleGeneratedMatchesSection
      emptyMessage={generatedEmptyMessage}
      isPrintDisabled={isGeneratedPrintDisabled}
      matches={generatedMatches}
      onPrint={onPrintGeneratedMatches}
      title={generatedTitle}
    />
  </OneVsOneSchedulePage>
);
