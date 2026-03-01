import type { ReactNode } from "react";
import type { MatchBlockState } from "@/widgets/schedule/schedule-utils";
import { SchedulePageLayout } from "./schedule-page-layout";

interface OneVsOneSchedulePageProps {
  alerts?: ReactNode;
  children: ReactNode;
  configSection?: ReactNode;
  defaultCycleTimeMinutes: number;
  errorMessage: string | null;
  eventCode: string;
  fieldCount?: number;
  fieldStartOffsetSeconds?: number;
  hasMatches: boolean;
  isLoading: boolean;
  matchBlocks: MatchBlockState[];
  onMatchBlocksChange: (blocks: MatchBlockState[]) => void;
  onScheduleDateChange: (date: string) => void;
  scheduleDate: string;
  successMessage: string | null;
  teamCount: number;
  title: string;
  toolbar: (args: { hasMatches: boolean }) => ReactNode;
}

export const OneVsOneSchedulePage = ({
  alerts,
  children,
  configSection,
  defaultCycleTimeMinutes,
  errorMessage,
  eventCode,
  fieldCount,
  fieldStartOffsetSeconds,
  hasMatches,
  isLoading,
  matchBlocks,
  onMatchBlocksChange,
  onScheduleDateChange,
  scheduleDate,
  successMessage,
  teamCount,
  title,
  toolbar,
}: OneVsOneSchedulePageProps): JSX.Element => (
  <SchedulePageLayout
    alerts={alerts}
    configSection={configSection}
    defaultCycleTimeMinutes={defaultCycleTimeMinutes}
    errorMessage={errorMessage}
    eventCode={eventCode}
    fieldCount={fieldCount}
    fieldStartOffsetSeconds={fieldStartOffsetSeconds}
    isLoading={isLoading}
    matchBlocks={matchBlocks}
    onMatchBlocksChange={onMatchBlocksChange}
    onScheduleDateChange={onScheduleDateChange}
    scheduleDate={scheduleDate}
    successMessage={successMessage}
    teamCount={teamCount}
    title={title}
    toolbar={toolbar({ hasMatches })}
  >
    {children}
  </SchedulePageLayout>
);
