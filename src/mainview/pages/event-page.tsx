import { LoadingIndicator } from "../shared/components/loading-indicator";
import type { EventItem } from "../shared/types/event";

interface EventPageProps {
  eventCode: string;
  events: EventItem[];
  isEventsLoading: boolean;
}

export const EventPage = ({
  eventCode,
  events,
  isEventsLoading,
}: EventPageProps): JSX.Element => {
  if (isEventsLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  const event = events.find((eventItem) => eventItem.code === eventCode);

  return (
    <main className="page-shell page-shell--top">
      <div className="card surface-card surface-card--medium stack stack--compact">
        <h2 className="app-heading">Event Overview (Development)</h2>
        <p className="form-note">
          <strong>Event Code:</strong> {eventCode}
        </p>
        <p className="form-note">
          <strong>Event Name:</strong> {event?.name ?? "Not found"}
        </p>
      </div>
    </main>
  );
};
