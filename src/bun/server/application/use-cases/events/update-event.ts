import { ApplicationError } from "../../common/application-error";
import type { EventItem, UpdateEventInput } from "../../dtos/events";
import type { EventRepository } from "../../interfaces/event-repository";
import { normalizeEventsEventCode } from "./shared";

export interface UpdateEventCommand {
  eventCode: string;
  payload: UpdateEventInput;
}

export class UpdateEventUseCase {
  constructor(private readonly eventRepository: EventRepository) {}

  async execute(command: UpdateEventCommand): Promise<EventItem> {
    const eventCode = normalizeEventsEventCode(command.eventCode);
    const event = await this.eventRepository.updateEvent(
      eventCode,
      command.payload
    );

    if (!event) {
      throw new ApplicationError(`Event "${eventCode}" was not found.`, 404);
    }

    return event;
  }
}
