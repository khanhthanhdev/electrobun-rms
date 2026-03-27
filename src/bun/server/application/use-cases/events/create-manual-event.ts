import type {
  CreateManualEventResponse,
  ManualEventInput,
} from "../../dtos/events";
import { type MaybePromise, normalizeEventsEventCode } from "./shared";

export interface ManualEventService {
  createManualEvent(
    payload: ManualEventInput
  ): MaybePromise<CreateManualEventResponse>;
}

export interface CreateManualEventCommand {
  payload: ManualEventInput;
}

export class CreateManualEventUseCase {
  constructor(
    private readonly manualEventService: ManualEventService
  ) {}

  async execute(
    command: CreateManualEventCommand
  ): Promise<CreateManualEventResponse> {
    const createdEvent =
      await this.manualEventService.createManualEvent({
        ...command.payload,
        eventCode: normalizeEventsEventCode(command.payload.eventCode),
      });

    return createdEvent;
  }
}
