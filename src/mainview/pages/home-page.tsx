import { EventsSection } from "../features/events/components/events-section";
import type { EventItem } from "../shared/types/event";

interface HomePageProps {
  events: EventItem[];
  isEventsLoading: boolean;
  onNavigate: (path: string) => void;
}

export const HomePage = ({
  events,
  isEventsLoading,
  onNavigate,
}: HomePageProps): JSX.Element => (
  <main className="home-page">
    <EventsSection
      events={events}
      isLoading={isEventsLoading}
      onNavigate={onNavigate}
    />
  </main>
);
