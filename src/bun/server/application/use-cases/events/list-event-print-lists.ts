import type { EventPrintListsResponse } from "../../dtos/events";
import { type MaybePromise, normalizeEventsEventCode } from "./shared";

export interface EventPrintListsService {
  getEventPrintLists(eventCode: string): MaybePromise<EventPrintListsResponse>;
}

export interface ListEventPrintListsQuery {
  eventCode: string;
}

export class ListEventPrintListsUseCase {
  constructor(
    private readonly eventPrintListsService: EventPrintListsService
  ) {}

  async execute(
    query: ListEventPrintListsQuery
  ): Promise<EventPrintListsResponse> {
    const eventCode = normalizeEventsEventCode(query.eventCode);
    const printLists =
      await this.eventPrintListsService.getEventPrintLists(eventCode);
    return printLists;
  }
}
