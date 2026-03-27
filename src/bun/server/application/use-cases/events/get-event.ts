import type { EventItem } from "../../dtos/events";
import type { EventRepository } from "../../interfaces/event-repository";
import { normalizeEventsEventCode } from "./shared";

export interface GetEventQuery {
  eventCode: string;
}

export class GetEventUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(query: GetEventQuery): Promise<EventItem | null> {
    const eventCode = normalizeEventsEventCode(query.eventCode);
    const event = await this.eventRepository.getEvent(eventCode);
    return event;
  }
}
