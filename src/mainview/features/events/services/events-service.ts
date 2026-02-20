import { requestJson } from "../../../shared/api/http-client";
import type { EventItem } from "../../../shared/types/event";

interface EventsResponse {
  events: EventItem[];
}

export const fetchEvents = async (
  refreshKey?: number
): Promise<EventItem[]> => {
  const path =
    refreshKey === undefined
      ? "/events"
      : `/events?refresh=${refreshKey.toString()}`;
  const data = await requestJson<EventsResponse>(path, {
    cache: "no-store",
  });
  return data.events;
};
