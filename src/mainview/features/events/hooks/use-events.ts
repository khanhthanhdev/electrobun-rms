import { useEffect, useState } from "react";
import type { EventItem } from "../../../shared/types/event";
import { fetchEvents } from "../services/events-service";

interface UseEventsResult {
  events: EventItem[];
  isEventsLoading: boolean;
}

export const useEvents = (): UseEventsResult => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const setEventsIfMounted = (eventItems: EventItem[]): void => {
      if (isCancelled) {
        return;
      }
      setEvents(eventItems);
    };

    const setLoadingIfMounted = (value: boolean): void => {
      if (isCancelled) {
        return;
      }
      setIsEventsLoading(value);
    };

    setLoadingIfMounted(true);

    fetchEvents()
      .then((eventItems) => {
        setEventsIfMounted(eventItems);
      })
      .catch(() => {
        setEventsIfMounted([]);
      })
      .finally(() => {
        setLoadingIfMounted(false);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    events,
    isEventsLoading,
  };
};
