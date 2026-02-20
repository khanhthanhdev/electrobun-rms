import { useCallback, useEffect, useState } from "react";
import type { EventItem } from "../../../shared/types/event";
import { fetchEvents } from "../services/events-service";

interface UseEventsResult {
  events: EventItem[];
  isEventsLoading: boolean;
  refreshEvents: () => void;
}

export const useEvents = (): UseEventsResult => {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState(true);
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshEvents = useCallback((): void => {
    setRefreshTick((currentTick) => currentTick + 1);
  }, []);

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

    fetchEvents(refreshTick)
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
  }, [refreshTick]);

  return {
    events,
    isEventsLoading,
    refreshEvents,
  };
};
