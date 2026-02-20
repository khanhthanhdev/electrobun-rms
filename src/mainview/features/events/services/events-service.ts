import { requestJson } from "../../../shared/api/http-client";
import type { EventItem } from "../../../shared/types/event";

interface EventsResponse {
  events: EventItem[];
}

export const fetchEvents = async (): Promise<EventItem[]> => {
  const data = await requestJson<EventsResponse>("/events");
  return data.events;
};
