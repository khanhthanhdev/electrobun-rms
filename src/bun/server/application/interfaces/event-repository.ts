import type { EventItem, UpdateEventInput } from "../dtos/events";

export interface EventRepository {
  getEvent(eventCode: string): Promise<EventItem | null>;

  listEvents(): Promise<EventItem[]>;

  updateEvent(
    eventCode: string,
    input: UpdateEventInput
  ): Promise<EventItem | null>;
}
