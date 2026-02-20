import { LoadingIndicator } from "../../../shared/components/loading-indicator";
import type { EventItem } from "../../../shared/types/event";
import { formatDate } from "../../../shared/utils/date";
import { EVENT_STATUS_LABELS } from "../constants/status-labels";

interface EventsSectionProps {
  events: EventItem[];
  isLoading: boolean;
  onNavigate: (path: string) => void;
}

interface EventsTableProps {
  emptyMessage: string;
  events: EventItem[];
  onNavigate: (path: string) => void;
  title: string;
  tone: "primary" | "secondary";
}

const ACTIVE_EVENT_STATUS = 1;

const formatEventStatus = (status: number): string =>
  EVENT_STATUS_LABELS[status] ?? `Status ${status}`;

const EventsTable = ({
  emptyMessage,
  events,
  onNavigate,
  title,
  tone,
}: EventsTableProps): JSX.Element => (
  <section className="events-table-section">
    <h2
      className={`events-table-section__title events-table-section__title--${tone}`}
    >
      {title}
    </h2>

    {events.length === 0 ? (
      <p className="empty-state">{emptyMessage}</p>
    ) : (
      <div className="events-table-wrapper">
        <table className="events-table">
          <thead>
            <tr>
              <th scope="col">Code</th>
              <th scope="col">Name</th>
              <th scope="col">Status</th>
              <th scope="col">Start-End</th>
            </tr>
          </thead>
          <tbody>
            {events.map((eventItem) => (
              <tr key={`${eventItem.code}-${title}`}>
                <td className="events-table__code">
                  <a
                    className="events-table__event-link"
                    href={`/event/${encodeURIComponent(eventItem.code)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(
                        `/event/${encodeURIComponent(eventItem.code)}`
                      );
                    }}
                  >
                    {eventItem.code}
                  </a>
                </td>
                <td className="events-table__name">
                  <a
                    className="events-table__event-link"
                    href={`/event/${encodeURIComponent(eventItem.code)}`}
                    onClick={(event) => {
                      event.preventDefault();
                      onNavigate(
                        `/event/${encodeURIComponent(eventItem.code)}`
                      );
                    }}
                  >
                    {eventItem.name}
                  </a>
                </td>
                <td>{formatEventStatus(eventItem.status)}</td>
                <td>
                  {formatDate(eventItem.start)} - {formatDate(eventItem.end)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export const EventsSection = ({
  events,
  isLoading,
  onNavigate,
}: EventsSectionProps): JSX.Element => {
  if (isLoading) {
    return (
      <section className="events-section">
        <LoadingIndicator />
      </section>
    );
  }

  const activeEvents = events.filter(
    (eventItem) => eventItem.status === ACTIVE_EVENT_STATUS
  );
  const displayedActiveEvents = activeEvents.length > 0 ? activeEvents : events;

  return (
    <section className="events-section">
      <EventsTable
        emptyMessage="No active events available."
        events={displayedActiveEvents}
        onNavigate={onNavigate}
        title="Active Events"
        tone="primary"
      />
      <EventsTable
        emptyMessage="No events available."
        events={events}
        onNavigate={onNavigate}
        title="All Events"
        tone="secondary"
      />
    </section>
  );
};
