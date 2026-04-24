import {
  fetchPracticeSchedule,
  printPracticeScheduleResults,
} from "@/features/events/schedule";
import { OneVsOneSchedulePublicView } from "./components/one-vs-one-schedule-public-view";

interface PracticeScheduleViewPageProps {
  eventCode: string;
  token: string | null;
}

export const PracticeScheduleViewPage = ({
  eventCode,
  token,
}: PracticeScheduleViewPageProps): JSX.Element => (
  <OneVsOneSchedulePublicView
    emptyMessage="No practice matches available."
    eventCode={eventCode}
    fetchSchedule={fetchPracticeSchedule}
    loadErrorMessage="Failed to load practice schedule."
    matchLabelPrefix="Practice"
    onPrint={({ eventCode: currentEventCode, rows }) => {
      printPracticeScheduleResults({
        destination: "paper",
        eventCode: currentEventCode,
        rows,
      });
    }}
    printAriaLabel="Print practice schedule"
    scheduleTitle="Practice Schedule"
    token={token}
  />
);
