import { EventsSection } from "../features/events/components/events-section";
import type { EventItem } from "../shared/types/event";

interface HomePageProps {
  events: EventItem[];
  isEventsLoading: boolean;
}

export const HomePage = ({
  events,
  isEventsLoading,
}: HomePageProps): JSX.Element => (
  <main className="home-page">
    <EventsSection events={events} isLoading={isEventsLoading} />
  </main>
);
