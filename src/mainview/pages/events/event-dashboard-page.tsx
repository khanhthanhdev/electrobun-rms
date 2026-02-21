import { LoadingIndicator } from "../../shared/components/loading-indicator";
import type { AuthUser } from "../../shared/types/auth";
import type { EventItem } from "../../shared/types/event";
import "../../app/styles/components/event-directory.css";

interface EventDashboardPageProps {
  eventCode: string;
  events: EventItem[];
  isEventsLoading: boolean;
  user: AuthUser | null;
}

interface DashboardItem {
  label: string;
  path: string;
}

interface DashboardSection {
  items: DashboardItem[];
  title: string;
}

const buildDashboardSections = (eventCode: string): DashboardSection[] => [
  {
    title: "Event Setup",
    items: [
      { label: "Edit Event", path: `/event/${eventCode}/edit` },
      {
        label: "Create Default Accounts",
        path: `/event/${eventCode}/dashboard/defaultaccounts`,
      },
      {
        label: "Add/Edit Teams",
        path: `/event/${eventCode}/dashboard/teams`,
      },
      {
        label: "Add/Edit Sponsors",
        path: `/event/${eventCode}/dashboard/sponsors`,
      },
    ],
  },
  {
    title: "Scheduling",
    items: [
      {
        label: "Judging & Inspection Schedule",
        path: `/event/${eventCode}/dashboard/judging-schedule`,
      },
      {
        label: "Practice Match Schedule",
        path: `/event/${eventCode}/dashboard/practice-schedule`,
      },
      {
        label: "Qualification Match Schedule",
        path: `/event/${eventCode}/dashboard/qualification-schedule`,
      },
    ],
  },
  {
    title: "Match Control",
    items: [
      {
        label: "Match Control Page",
        path: `/event/${eventCode}/dashboard/match-control`,
      },
      {
        label: "Alliance Selection",
        path: `/event/${eventCode}/dashboard/alliance-selection`,
      },
    ],
  },
  {
    title: "Awards & Reports",
    items: [
      {
        label: "Manage Awards",
        path: `/event/${eventCode}/dashboard/awards`,
      },
      {
        label: "Event Reports",
        path: `/event/${eventCode}/dashboard/reports`,
      },
    ],
  },
];

export const EventDashboardPage = ({
  eventCode,
  events,
  isEventsLoading,
  user,
}: EventDashboardPageProps): JSX.Element => {
  if (isEventsLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            You must be logged in to access the dashboard.
          </p>
          <a className="app-link-inline" href="/">
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  const event = events.find((e) => e.code === eventCode);

  if (!event) {
    return (
      <main className="page-shell page-shell--center">
        <div className="card surface-card surface-card--small stack stack--compact">
          <p className="message-block" data-variant="danger" role="alert">
            Event not found.
          </p>
          <a className="app-link-inline" href="/">
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  const sections = buildDashboardSections(eventCode);

  return (
    <main className="event-directory-page">
      <div className="event-directory-container">
        <h1 className="event-directory-title">
          {eventCode}: {event?.name ?? "Event"} — Dashboard
        </h1>

        <div className="event-directory-grid">
          {sections.map((section) => (
            <section className="event-directory-section" key={section.title}>
              <h2 className="event-directory-section-title">{section.title}</h2>
              <ul className="event-directory-list">
                {section.items.map((item) => (
                  <li key={item.label}>
                    <a href={item.path}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div style={{ marginTop: "var(--space-6)" }}>
          <a className="button" href={`/event/${eventCode}`}>
            Back to Event
          </a>
        </div>
      </div>
    </main>
  );
};
