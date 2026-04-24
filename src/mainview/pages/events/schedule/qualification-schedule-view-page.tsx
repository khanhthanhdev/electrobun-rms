import {
  fetchQualificationSchedule,
  printQualificationScheduleResults,
} from "@/features/events/schedule";
import { OneVsOneSchedulePublicView } from "./components/one-vs-one-schedule-public-view";

interface QualificationScheduleViewPageProps {
  eventCode: string;
  token: string | null;
}

export const QualificationScheduleViewPage = ({
  eventCode,
  token,
}: QualificationScheduleViewPageProps): JSX.Element => (
  <OneVsOneSchedulePublicView
    emptyMessage="No qualification matches available."
    eventCode={eventCode}
    fetchSchedule={fetchQualificationSchedule}
    loadErrorMessage="Failed to load qualification schedule."
    matchLabelPrefix="Qualification"
    onPrint={({ eventCode: currentEventCode, rows }) => {
      printQualificationScheduleResults({
        destination: "paper",
        eventCode: currentEventCode,
        rows,
      });
    }}
    printAriaLabel="Print qualification schedule"
    scheduleTitle="Qualification Schedule"
    token={token}
  />
);
