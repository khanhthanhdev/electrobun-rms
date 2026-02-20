import type { EventItem } from "../../../shared/types/event";
import { formatDate } from "../../../shared/utils/date";
import { EVENT_STATUS_LABELS } from "../constants/status-labels";

interface EventCardProps {
  event: EventItem;
}

const getBadgeClass = (status: number): string => {
  if (status === 1) {
    return "success";
  }

  if (status === 2) {
    return "secondary";
  }

  return "";
};

export const EventCard = ({ event }: EventCardProps): JSX.Element => (
  <article className="card event-card">
    <header>
      <h3>{event.name}</h3>
      <span className={`badge ${getBadgeClass(event.status)}`}>
        {EVENT_STATUS_LABELS[event.status] ?? `Status ${event.status}`}
      </span>
    </header>

    <table className="event-meta">
      <tbody>
        <tr>
          <td>Code</td>
          <td>
            <code>{event.code}</code>
          </td>
        </tr>
        <tr>
          <td>Region</td>
          <td>{event.region}</td>
        </tr>
        <tr>
          <td>Dates</td>
          <td>
            {formatDate(event.start)} - {formatDate(event.end)}
          </td>
        </tr>
        <tr>
          <td>Divisions</td>
          <td>{event.divisions}</td>
        </tr>
      </tbody>
    </table>
  </article>
);
