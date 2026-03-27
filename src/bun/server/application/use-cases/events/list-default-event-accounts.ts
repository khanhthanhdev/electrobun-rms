import type { DefaultEventAccountsResponse } from "../../dtos/events";
import { type MaybePromise, normalizeEventsEventCode } from "./shared";

export interface DefaultEventAccountsService {
  getDefaultAccounts(
    eventCode: string
  ): MaybePromise<DefaultEventAccountsResponse>;
}

export interface ListDefaultEventAccountsQuery {
  eventCode: string;
}

export class ListDefaultEventAccountsUseCase {
  constructor(
    private readonly defaultEventAccountsService: DefaultEventAccountsService
  ) {}

  async execute(
    query: ListDefaultEventAccountsQuery
  ): Promise<DefaultEventAccountsResponse> {
    const eventCode = normalizeEventsEventCode(query.eventCode);
    const accounts =
      await this.defaultEventAccountsService.getDefaultAccounts(eventCode);
    return accounts;
  }
}
