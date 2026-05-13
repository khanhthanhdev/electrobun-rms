import type { ReactNode } from "react";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import { SchedulePageLayout } from "./schedule-page-layout";

interface OneVsOneSchedulePageProps {
  alerts?: ReactNode;
  children: ReactNode;
  configSection?: ReactNode;
  defaultCycleTimeMinutes: number;
  errorMessage: string | null;
  hasMatches: boolean;
  isLoading: boolean;
  matchBlocks: MatchBlockState[];
  matchEditorMode?: "practice" | "qualification";
  onCycleTimeSecondsChange?: (seconds: number) => void;
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  onScheduleDateChange: (date: string) => void;
  scheduleDate: string;
  successMessage: string | null;
  title: string;
  toolbar: (args: { hasMatches: boolean }) => ReactNode;
}

export const OneVsOneSchedulePage = ({
  alerts,
  children,
  configSection,
  defaultCycleTimeMinutes,
  errorMessage,
  hasMatches,
  isLoading,
  matchBlocks,
  matchEditorMode,
  onCycleTimeSecondsChange,
  onMatchBlocksChange,
  onScheduleDateChange,
  scheduleDate,
  successMessage,
  title,
  toolbar,
}: OneVsOneSchedulePageProps): JSX.Element => (
  <SchedulePageLayout
    alerts={alerts}
    configSection={configSection}
    defaultCycleTimeMinutes={defaultCycleTimeMinutes}
    errorMessage={errorMessage}
    isLoading={isLoading}
    matchBlocks={matchBlocks}
    matchEditorMode={matchEditorMode}
    onCycleTimeSecondsChange={onCycleTimeSecondsChange}
    onMatchBlocksChange={onMatchBlocksChange}
    onScheduleDateChange={onScheduleDateChange}
    scheduleDate={scheduleDate}
    successMessage={successMessage}
    title={title}
    toolbar={toolbar({ hasMatches })}
  >
    {children}
  </SchedulePageLayout>
);
