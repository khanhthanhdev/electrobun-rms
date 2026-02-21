import { LoadingIndicator } from "../../shared/components/loading-indicator";
import type { AuthUser } from "../../shared/types/auth";
import type { EventItem } from "../../shared/types/event";
import "../../app/styles/components/event-directory.css";

interface EventPageProps {
  eventCode: string;
  events: EventItem[];
  isEventsLoading: boolean;
  user: AuthUser | null;
}

interface DirectorySection {
  items: (DirectoryItem | DirectoryCategory)[];
  title: string;
}

interface DirectoryItem {
  label: string;
  path: string;
  type: "item";
}

interface DirectoryCategory {
  items: DirectoryItem[];
  label: string;
  type: "category";
}

const EVENT_DIRECTORY: Record<string, DirectorySection[]> = {
  public: [
    {
      title: "Event Info",
      items: [
        {
          type: "item",
          label: "Judging & Inspection Schedule",
          path: "/judging-schedule",
        },
        {
          type: "item",
          label: "Judging & Inspection Status",
          path: "/judging-status",
        },
        {
          type: "category",
          label: "Practice",
          items: [
            { type: "item", label: "Schedule", path: "/practice/schedule" },
          ],
        },
        {
          type: "category",
          label: "Qualification",
          items: [
            {
              type: "item",
              label: "Schedule",
              path: "/qualification/schedule",
            },
            {
              type: "item",
              label: "Rankings",
              path: "/qualification/rankings",
            },
          ],
        },
        {
          type: "category",
          label: "Playoff",
          items: [
            { type: "item", label: "Schedule", path: "/playoff/schedule" },
            { type: "item", label: "Bracket", path: "/playoff/bracket" },
          ],
        },
        { type: "item", label: "Match Results", path: "/match-results" },
        { type: "item", label: "Pit Display", path: "/pit-display" },
        { type: "item", label: "Event Reports", path: "/event-reports" },
      ],
    },
    {
      title: "Displays",
      items: [
        {
          type: "item",
          label: "Scoring/Timing Displays",
          path: "/displays/scoring",
        },
        { type: "item", label: "Pit Display", path: "/displays/pit" },
      ],
    },
  ],
  authenticated: [
    {
      title: "Event Info",
      items: [
        {
          type: "item",
          label: "Judging & Inspection Schedule",
          path: "/judging-schedule",
        },
        {
          type: "item",
          label: "Judging & Inspection Status",
          path: "/judging-status",
        },
        {
          type: "category",
          label: "Practice",
          items: [
            { type: "item", label: "Schedule", path: "/practice/schedule" },
          ],
        },
        {
          type: "category",
          label: "Qualification",
          items: [
            {
              type: "item",
              label: "Schedule",
              path: "/qualification/schedule",
            },
            {
              type: "item",
              label: "Rankings",
              path: "/qualification/rankings",
            },
          ],
        },
        {
          type: "category",
          label: "Playoff",
          items: [
            { type: "item", label: "Schedule", path: "/playoff/schedule" },
            { type: "item", label: "Bracket", path: "/playoff/bracket" },
          ],
        },
        { type: "item", label: "Match Results", path: "/match-results" },
        { type: "item", label: "Pit Display", path: "/pit-display" },
        { type: "item", label: "Event Reports", path: "/event-reports" },
      ],
    },
    {
      title: "FTA/CSA Tools",
      items: [
        { type: "item", label: "FTA Notepad", path: "/fta/notepad" },
        {
          type: "category",
          label: "Displays",
          items: [
            {
              type: "item",
              label: "Scoring/Timing Displays",
              path: "/displays/scoring",
            },
            { type: "item", label: "Pit Display", path: "/displays/pit" },
          ],
        },
        {
          type: "category",
          label: "Judging",
          items: [
            { type: "item", label: "Manage Awards", path: "/judging/awards" },
          ],
        },
        {
          type: "category",
          label: "GA/Emcee",
          items: [
            {
              type: "item",
              label: "Opening Ceremony Script",
              path: "/emcee/opening",
            },
            { type: "item", label: "Announcer Report", path: "/emcee/report" },
            {
              type: "item",
              label: "Alliance Selection",
              path: "/emcee/alliance-selection",
            },
            {
              type: "item",
              label: "Closing Ceremony Script",
              path: "/emcee/closing",
            },
          ],
        },
      ],
    },
    {
      title: "Referee Tools",
      items: [
        {
          type: "category",
          label: "Referee Score Tracking",
          items: [
            {
              type: "item",
              label: "Red Scoring Referee",
              path: "/referee/red",
            },
            {
              type: "item",
              label: "Blue Scoring Referee",
              path: "/referee/blue",
            },
            { type: "item", label: "Head Referee", path: "/referee/head" },
          ],
        },
      ],
    },
    {
      title: "Event Administration",
      items: [
        { type: "item", label: "Event Dashboard", path: "/dashboard" },
        {
          type: "item",
          label: "Match Control Page",
          path: "/match-control",
        },
      ],
    },
  ],
};

const renderDirectoryItem = (
  item: DirectoryItem | DirectoryCategory,
  baseEventPath: string
): JSX.Element => {
  if (item.type === "item") {
    return (
      <li key={item.label}>
        <a href={`${baseEventPath}${item.path}`}>{item.label}</a>
      </li>
    );
  }

  return (
    <li key={item.label}>
      {item.label}
      <ul>
        {item.items.map((subItem) =>
          renderDirectoryItem(subItem, baseEventPath)
        )}
      </ul>
    </li>
  );
};

export const EventPage = ({
  eventCode,
  events,
  isEventsLoading,
  user,
}: EventPageProps): JSX.Element => {
  if (isEventsLoading) {
    return (
      <main className="page-shell page-shell--center">
        <LoadingIndicator />
      </main>
    );
  }

  const event = events.find((eventItem) => eventItem.code === eventCode);
  const baseEventPath = `/event/${eventCode}`;
  const sections = user
    ? EVENT_DIRECTORY.authenticated
    : EVENT_DIRECTORY.public;

  return (
    <main className="event-directory-page">
      <div className="event-directory-container">
        <h1 className="event-directory-title">
          {eventCode}: {event?.name ?? "Event"}
        </h1>

        <div className="event-directory-grid">
          {sections.map((section) => (
            <section className="event-directory-section" key={section.title}>
              <h2 className="event-directory-section-title">{section.title}</h2>
              <ul className="event-directory-list">
                {section.items.map((item) =>
                  renderDirectoryItem(item, baseEventPath)
                )}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
};
