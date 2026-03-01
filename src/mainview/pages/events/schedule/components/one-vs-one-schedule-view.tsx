import type { ReactNode } from "react";
import type { PrintDestination } from "@/shared/services/print-service";
import type { ScheduleMatchRow } from "@/widgets/schedule/schedule-match-table";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import { OneVsOneSchedulePage } from "./one-vs-one-schedule-page";
import { ScheduleGeneratedMatchesSection } from "./schedule-generated-matches-section";

interface OneVsOneScheduleViewProps {
  alerts?: ReactNode;
  beforeGeneratedSection?: ReactNode;
  configSection?: ReactNode;
  defaultCycleTimeMinutes: number;
  errorMessage: string | null;
  eventCode: string;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
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
  fieldCount,
  fieldStartOffsetSeconds,
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
    fieldCount={fieldCount}
    fieldStartOffsetSeconds={fieldStartOffsetSeconds}
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
