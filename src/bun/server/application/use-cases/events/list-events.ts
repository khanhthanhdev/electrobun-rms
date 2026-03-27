import type { EventsResponse } from "../../dtos/events";
import type { EventRepository } from "../../interfaces/event-repository";

export class ListEventsUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(): Promise<EventsResponse> {
    const events = await this.eventRepository.listEvents();
    return { events };
  }
}
